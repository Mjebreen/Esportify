'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { notify } from '@/server/notify/notify';
import {
  commentCreateSchema,
  requestUpdateSchema,
  type CommentCreateInput,
  type RequestUpdateInput,
} from '../schema';
import { requestVisibilityWhere } from './queries';

// NOTE: the canonical request-creation entry point is submitRequest (./submit.ts),
// which enforces the player → team-manager approval gate. A direct, gate-skipping
// createRequest was removed to prevent it being wired up by mistake.

export const updateRequest = tenantAction('request', 'update', async (ctx, raw: RequestUpdateInput) => {
  const input = requestUpdateSchema.parse(raw);
  // A self-service requester (own scope) may edit their own request, but cannot
  // reassign it to others or re-route it to a different department.
  if (ctx.scope === 'own' && (input.assigneeUserId !== undefined || input.targetDepartmentId !== undefined)) {
    throw new DomainError('Requesters cannot reassign or re-route their requests', 'forbidden');
  }
  // Write scope must match read visibility (own ∪ department ∪ org) so a handler can
  // act on any request they can see — e.g. one they raised but routed to another dept.
  const where = { id: input.id, ...requestVisibilityWhere(ctx.principal) } as Prisma.RequestWhereInput;
  const before = await ctx.tx.request.findFirst({ where });
  if (!before) throw new DomainError('Request not found', 'not_found');

  // Scalars go through the scoped updateMany (locks the row + enforces scope).
  const scalar: Prisma.RequestUpdateManyMutationInput = {};
  if (input.status !== undefined) scalar.status = input.status;
  if (input.priority !== undefined) scalar.priority = input.priority;
  if (input.dueDate !== undefined) scalar.dueDate = input.dueDate ?? null;
  if (Object.keys(scalar).length === 0) scalar.status = before.status; // ensure a locking write

  const res = await ctx.tx.request.updateMany({ where, data: scalar });
  if (res.count !== 1) throw new DomainError('Request not found', 'not_found');

  // Relation-scalar FKs on the now-locked, in-scope row.
  const fk: Prisma.RequestUncheckedUpdateInput = {};
  if (input.assigneeUserId !== undefined) fk.assigneeUserId = input.assigneeUserId ?? null;
  if (input.targetDepartmentId !== undefined) fk.targetDepartmentId = input.targetDepartmentId ?? null;
  if (Object.keys(fk).length) await ctx.tx.request.update({ where: { id: input.id }, data: fk });

  const after = await ctx.tx.request.findUniqueOrThrow({ where: { id: input.id } });

  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Request', entityId: input.id, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown> });

  // Notify on assignment / status change.
  if (input.assigneeUserId && input.assigneeUserId !== before.assigneeUserId) {
    await notify(ctx.tx, { userId: input.assigneeUserId, type: 'REQUEST_ASSIGNED', title: `Assigned: ${after.title}`, entityType: 'Request', entityId: after.id });
  }
  if (input.status && input.status !== before.status && before.requesterUserId !== ctx.principal.userId) {
    await notify(ctx.tx, { userId: before.requesterUserId, type: 'REQUEST_STATUS', title: `Request ${input.status}: ${after.title}`, entityType: 'Request', entityId: after.id });
  }

  revalidatePath('/requests');
  revalidatePath(`/requests/${input.id}`);
  return { id: input.id };
});

export const addRequestComment = tenantAction('request', 'read', async (ctx, raw: CommentCreateInput) => {
  const input = commentCreateSchema.parse(raw);
  if (!input.requestId) throw new DomainError('Missing request', 'invalid');

  const parent = await ctx.tx.request.findFirst({
    where: { id: input.requestId, ...requestVisibilityWhere(ctx.principal) },
    select: { id: true, title: true, requesterUserId: true, assigneeUserId: true },
  });
  if (!parent) throw new DomainError('Request not found', 'not_found');

  await ctx.tx.comment.create({
    data: { organizationId: ctx.principal.organizationId, authorUserId: ctx.principal.userId, body: input.body, requestId: parent.id },
  });

  for (const uid of [parent.requesterUserId, parent.assigneeUserId]) {
    if (uid && uid !== ctx.principal.userId) {
      await notify(ctx.tx, { userId: uid, type: 'COMMENT', title: `New comment: ${parent.title}`, entityType: 'Request', entityId: parent.id });
    }
  }
  revalidatePath(`/requests/${parent.id}`);
  return { id: parent.id };
});
