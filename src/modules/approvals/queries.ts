import type { WorkflowItem } from '@prisma/client';
import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import { canActAtStep, canExecute, type WorkflowStep } from '@/server/workflow/engine';
import { WORKFLOW_CONFIG } from '@/server/workflow/config';

export interface ApprovalCard {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  status: string;
  subject: string | null;
  requester: string;
  currentRole: string | null;
  at: string;
  rejectionReason: string | null;
}

export interface ApprovalsView {
  toApprove: ApprovalCard[];
  toExecute: ApprovalCard[];
  mine: ApprovalCard[];
}

function toCard(item: WorkflowItem, names: { subject?: string | null; requester?: string | null }): ApprovalCard {
  const steps = (item.steps as unknown as WorkflowStep[]) ?? [];
  return {
    id: item.id,
    type: item.type,
    typeLabel: WORKFLOW_CONFIG[item.type].label,
    title: item.title,
    status: item.status,
    subject: names.subject ?? null,
    requester: names.requester ?? '—',
    currentRole: item.status === 'PENDING' ? steps[item.currentStep]?.role ?? null : item.status === 'APPROVED' ? item.executorRole : null,
    at: item.createdAt.toISOString().slice(0, 10),
    rejectionReason: item.rejectionReason,
  };
}

export async function listApprovals(): Promise<ApprovalsView> {
  const principal = await requirePrincipal();
  return withOrgTx(principal.organizationId, async (tx) => {
    const open = await tx.workflowItem.findMany({
      where: { deletedAt: null, status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
      include: { subjectPlayer: { select: { inGameName: true } }, requester: { select: { name: true, email: true } } },
    });
    const mineRows = await tx.workflowItem.findMany({
      where: { deletedAt: null, requesterUserId: principal.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { subjectPlayer: { select: { inGameName: true } }, requester: { select: { name: true, email: true } } },
    });

    const card = (i: (typeof open)[number]) => toCard(i, { subject: i.subjectPlayer?.inGameName, requester: i.requester.name ?? i.requester.email });

    return {
      toApprove: open.filter((i) => canActAtStep(principal, i)).map(card),
      toExecute: open.filter((i) => canExecute(principal, i)).map(card),
      mine: mineRows.map(card),
    };
  });
}
