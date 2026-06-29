import type { Priority, RequestType, SystemRole, WorkflowItem, WorkflowType } from '@prisma/client';
import { requireActiveOrgId, type TxClient } from '../db/tenant';
import { notify } from '../notify/notify';
import { writeAudit } from '../audit/audit';
import type { Principal } from '../authz/types';
import { WORKFLOW_CONFIG, type StepRole } from './config';

export interface WorkflowStep {
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  actorUserId?: string;
  decidedAt?: string;
  note?: string;
}

const ADMIN_ROLES: SystemRole[] = ['SUPER_ADMIN', 'IT'];
const systemRoleFor = (role: string): string => (role === 'ESPORTS_MANAGER' ? 'LEADERSHIP' : role);

function getSteps(item: WorkflowItem): WorkflowStep[] {
  return (item.steps as unknown as WorkflowStep[]) ?? [];
}

/** Does the principal satisfy a step/executor role for this item? */
function roleMatches(principal: Principal, role: string, item: Pick<WorkflowItem, 'subjectRosterId'>): boolean {
  if (principal.roleHints.some((r) => ADMIN_ROLES.includes(r))) return true; // admin override
  if (role === 'TEAM_MANAGER') {
    return !!item.subjectRosterId && principal.managedRosterIds.includes(item.subjectRosterId);
  }
  return principal.roleHints.includes(systemRoleFor(role) as SystemRole);
}

/** Can the principal act on the CURRENT approval step? */
export function canActAtStep(principal: Principal, item: WorkflowItem): boolean {
  if (item.status !== 'PENDING') return false;
  const step = getSteps(item)[item.currentStep];
  return step ? roleMatches(principal, step.role, item) : false;
}

/** Can the principal execute (fulfil) an approved item? */
export function canExecute(principal: Principal, item: WorkflowItem): boolean {
  if (item.status !== 'APPROVED' || !item.executorRole) return false;
  return roleMatches(principal, item.executorRole, item);
}

/** Users to notify for a given role on this item. */
async function resolveRoleUserIds(tx: TxClient, role: string, item: Pick<WorkflowItem, 'subjectRosterId'>): Promise<string[]> {
  if (role === 'TEAM_MANAGER') {
    if (!item.subjectRosterId) return [];
    const r = await tx.roster.findFirst({ where: { id: item.subjectRosterId }, select: { manager: { select: { userId: true } } } });
    return r?.manager?.userId ? [r.manager.userId] : [];
  }
  const roles = await tx.role.findMany({ where: { systemRole: systemRoleFor(role) as SystemRole }, select: { id: true } });
  if (roles.length === 0) return [];
  const ms = await tx.membership.findMany({
    where: { roleId: { in: roles.map((x) => x.id) }, status: 'ACTIVE', deletedAt: null },
    select: { userId: true },
    distinct: ['userId'],
  });
  return ms.map((m) => m.userId);
}

async function notifyRole(tx: TxClient, role: string, item: WorkflowItem, title: string): Promise<void> {
  for (const userId of await resolveRoleUserIds(tx, role, item)) {
    await notify(tx, { userId, type: 'GENERIC', title, entityType: 'WorkflowItem', entityId: item.id });
  }
}

export interface CreateWorkflowInput {
  type: WorkflowType;
  title: string;
  subjectPlayerId?: string | null;
  subjectRosterId?: string | null;
  targetDepartmentId?: string | null;
  payload?: Record<string, unknown>;
  /** Override the default chain (e.g. Marcom-initiated photo needs an extra approver). */
  chain?: StepRole[];
  executorRole?: string | null;
}

/** Create a workflow item, set its chain, and notify the first actor. */
export async function createWorkflow(tx: TxClient, principal: Principal, input: CreateWorkflowInput): Promise<{ id: string }> {
  const cfg = WORKFLOW_CONFIG[input.type];
  const chain = input.chain ?? cfg.approverChain;
  const steps: WorkflowStep[] = chain.map((role) => ({ role, status: 'PENDING' }));
  const status = steps.length > 0 ? 'PENDING' : 'APPROVED';
  const executorRole = input.executorRole !== undefined ? input.executorRole : cfg.executorRole;

  const item = await tx.workflowItem.create({
    data: {
      organizationId: requireActiveOrgId(),
      type: input.type,
      title: input.title,
      status,
      requesterUserId: principal.userId,
      subjectPlayerId: input.subjectPlayerId ?? null,
      subjectRosterId: input.subjectRosterId ?? null,
      targetDepartmentId: input.targetDepartmentId ?? null,
      steps: steps as unknown as object,
      currentStep: 0,
      executorRole: executorRole ?? null,
      payload: (input.payload ?? undefined) as object | undefined,
    },
  });

  await writeAudit(tx, { actorUserId: principal.userId, action: 'CREATE', entity: 'WorkflowItem', entityId: item.id, after: { type: item.type, title: item.title } });

  if (status === 'PENDING') await notifyRole(tx, chain[0]!, item, `Awaiting your approval: ${item.title}`);
  else if (executorRole) await notifyRole(tx, executorRole, item, `Ready to action: ${item.title}`);

  return { id: item.id };
}

/** Approve the current step; advance the chain or hand to the executor. */
export async function approveStep(tx: TxClient, principal: Principal, item: WorkflowItem, note?: string): Promise<void> {
  if (!canActAtStep(principal, item)) throw new Error('Forbidden: not the current approver');
  const steps = getSteps(item);
  steps[item.currentStep] = { ...steps[item.currentStep]!, status: 'APPROVED', actorUserId: principal.userId, decidedAt: new Date().toISOString(), note };

  const isLast = item.currentStep + 1 >= steps.length;
  const data = isLast
    ? { steps: steps as unknown as object, status: 'APPROVED' as const }
    : { steps: steps as unknown as object, currentStep: item.currentStep + 1 };
  await tx.workflowItem.update({ where: { id: item.id }, data });
  await writeAudit(tx, { actorUserId: principal.userId, action: 'UPDATE', entity: 'WorkflowItem', entityId: item.id, after: { step: item.currentStep, decision: 'APPROVED' } });

  if (!isLast) {
    await notifyRole(tx, steps[item.currentStep + 1]!.role, item, `Awaiting your approval: ${item.title}`);
  } else if (item.executorRole) {
    await notifyRole(tx, item.executorRole, item, `Approved — ready to action: ${item.title}`);
    await notify(tx, { userId: item.requesterUserId, type: 'GENERIC', title: `Approved: ${item.title}`, entityType: 'WorkflowItem', entityId: item.id });
  } else {
    await onComplete(tx, item);
    await tx.workflowItem.update({ where: { id: item.id }, data: { status: 'COMPLETED' } });
    await notify(tx, { userId: item.requesterUserId, type: 'GENERIC', title: `Done: ${item.title}`, entityType: 'WorkflowItem', entityId: item.id });
  }
}

/**
 * Side effects when an item completes at the end of its approval chain (no executor).
 * REQUEST: materialise the approved request into the normal Request queue, routed to
 * the selected (or Management) department, so departments handle it as usual.
 */
async function onComplete(tx: TxClient, item: WorkflowItem): Promise<void> {
  if (item.type === 'REQUEST') {
    const p = (item.payload as Record<string, unknown> | null) ?? {};
    await tx.request.create({
      data: {
        organizationId: requireActiveOrgId(),
        type: (p.requestType as RequestType) ?? 'GENERAL',
        title: item.title,
        description: (p.description as string) ?? null,
        priority: (p.priority as Priority) ?? 'MEDIUM',
        targetDepartmentId: (p.targetDepartmentId as string) ?? null,
        dueDate: p.dueDate ? new Date(p.dueDate as string) : null,
        requesterUserId: item.requesterUserId,
      },
    });
  }
}

export async function rejectStep(tx: TxClient, principal: Principal, item: WorkflowItem, reason?: string): Promise<void> {
  if (!canActAtStep(principal, item)) throw new Error('Forbidden: not the current approver');
  const steps = getSteps(item);
  steps[item.currentStep] = { ...steps[item.currentStep]!, status: 'REJECTED', actorUserId: principal.userId, decidedAt: new Date().toISOString(), note: reason };
  await tx.workflowItem.update({ where: { id: item.id }, data: { steps: steps as unknown as object, status: 'REJECTED', rejectionReason: reason ?? null } });
  await writeAudit(tx, { actorUserId: principal.userId, action: 'UPDATE', entity: 'WorkflowItem', entityId: item.id, after: { decision: 'REJECTED', reason: reason ?? null } });
  await notify(tx, { userId: item.requesterUserId, type: 'GENERIC', title: `Rejected: ${item.title}`, body: reason ?? null, entityType: 'WorkflowItem', entityId: item.id });
}

/** Executor fulfils an approved item. Runs type-specific side effects. */
export async function executeStep(tx: TxClient, principal: Principal, item: WorkflowItem, executionPayload?: Record<string, unknown>): Promise<void> {
  if (!canExecute(principal, item)) throw new Error('Forbidden: not the executor');
  const payload = { ...((item.payload as Record<string, unknown>) ?? {}), ...(executionPayload ?? {}) };

  await onExecute(tx, item, payload);

  await tx.workflowItem.update({ where: { id: item.id }, data: { status: 'COMPLETED', payload: payload as object } });
  await writeAudit(tx, { actorUserId: principal.userId, action: 'UPDATE', entity: 'WorkflowItem', entityId: item.id, after: { status: 'COMPLETED' } });
  await notify(tx, { userId: item.requesterUserId, type: 'GENERIC', title: `Completed: ${item.title}`, entityType: 'WorkflowItem', entityId: item.id });
}

/** Per-type completion side effects. */
async function onExecute(tx: TxClient, item: WorkflowItem, payload: Record<string, unknown>): Promise<void> {
  if (item.type === 'MERCH_KIT' && item.subjectPlayerId) {
    const season = String(payload.season ?? new Date().getFullYear());
    const existing = await tx.jerseyEntitlement.findFirst({ where: { playerId: item.subjectPlayerId, season }, select: { id: true } });
    if (existing) {
      await tx.jerseyEntitlement.update({ where: { id: existing.id }, data: { claimed: { increment: 1 } } });
    }
  }
}
