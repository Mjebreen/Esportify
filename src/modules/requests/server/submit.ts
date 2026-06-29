'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentPrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { withOrgTx } from '@/server/db/tenant';
import { writeAudit } from '@/server/audit/audit';
import { createWorkflow } from '@/server/workflow/engine';
import type { ActionResult } from '@/server/action';
import { requestCreateSchema, type RequestCreateInput } from '../schema';

/**
 * Raise a request.
 *  - Player on a roster → routed to their Team Manager for approval first; on
 *    approval the engine materialises it into the chosen (or Management) department.
 *  - Anyone else (managers/staff) → created directly into the department queue.
 * Returns `gated: true` when it went for manager approval (no Request row yet).
 */
export async function submitRequest(raw: RequestCreateInput): Promise<ActionResult<{ id: string; gated: boolean }>> {
  const input = requestCreateSchema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };
  if (!authorize(principal, 'create', 'request').allowed) return { ok: false, error: 'Not allowed to raise requests' };

  try {
    const result = await withOrgTx(principal.organizationId, async (tx) => {
      // Default routing target is the Management department.
      let departmentId = input.targetDepartmentId ?? null;
      let departmentName = 'Management';
      if (departmentId) {
        const dept = await tx.department.findFirst({ where: { id: departmentId }, select: { name: true } });
        departmentName = dept?.name ?? departmentName;
      } else {
        const mgmt = await tx.department.findFirst({ where: { type: 'MANAGEMENT' }, select: { id: true, name: true } });
        departmentId = mgmt?.id ?? null;
        departmentName = mgmt?.name ?? departmentName;
      }

      // Is the requester a player with a team manager (other than themselves)?
      const player = await tx.player.findFirst({
        where: { userId: principal.userId, deletedAt: null },
        select: { rosterId: true, roster: { select: { manager: { select: { userId: true } } } } },
      });
      const managerUserId = player?.roster?.manager?.userId ?? null;
      const needsApproval = !!player?.rosterId && !!managerUserId && managerUserId !== principal.userId;

      if (needsApproval) {
        const wf = await createWorkflow(tx, principal, {
          type: 'REQUEST',
          title: input.title,
          subjectRosterId: player!.rosterId,
          targetDepartmentId: departmentId,
          payload: {
            requestType: input.type,
            description: input.description ?? null,
            priority: input.priority ?? 'MEDIUM',
            targetDepartmentId: departmentId,
            departmentName,
            dueDate: input.dueDate ? input.dueDate.toISOString() : null,
          },
        });
        return { id: wf.id, gated: true };
      }

      // No manager gate → straight into the department queue.
      const row = await tx.request.create({
        data: {
          organizationId: principal.organizationId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'MEDIUM',
          targetDepartmentId: departmentId,
          dueDate: input.dueDate ?? null,
          requesterUserId: principal.userId,
        },
      });
      await writeAudit(tx, { actorUserId: principal.userId, action: 'CREATE', entity: 'Request', entityId: row.id, after: { title: row.title } });
      return { id: row.id, gated: false };
    });

    revalidatePath('/requests');
    revalidatePath('/approvals');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
