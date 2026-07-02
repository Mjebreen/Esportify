'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { notify } from '@/server/notify/notify';
import { assertActiveMember } from '@/server/org/members';
import { taskCreateSchema, taskUpdateSchema, type TaskCreateInput, type TaskUpdateInput } from '../schema';

export const createTask = tenantAction('task', 'create', async (ctx, raw: TaskCreateInput) => {
  const input = taskCreateSchema.parse(raw);
  if (input.assigneeUserId) await assertActiveMember(ctx.tx, input.assigneeUserId);
  const row = await ctx.tx.task.create({
    data: {
      organizationId: ctx.principal.organizationId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'MEDIUM',
      assigneeUserId: input.assigneeUserId ?? null,
      dueDate: input.dueDate ?? null,
      creatorUserId: ctx.principal.userId,
    },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'CREATE', entity: 'Task', entityId: row.id, after: row as unknown as Record<string, unknown> });
  if (input.assigneeUserId && input.assigneeUserId !== ctx.principal.userId) {
    await notify(ctx.tx, { userId: input.assigneeUserId, type: 'TASK_ASSIGNED', title: `Task assigned: ${row.title}`, entityType: 'Task', entityId: row.id });
  }
  revalidatePath('/tasks');
  return { id: row.id };
});

export const updateTask = tenantAction('task', 'update', async (ctx, raw: TaskUpdateInput) => {
  const input = taskUpdateSchema.parse(raw);
  const where = { id: input.id, deletedAt: null, ...(ctx.where as Prisma.TaskWhereInput) };
  const before = await ctx.tx.task.findFirst({ where });
  if (!before) throw new DomainError('Task not found', 'not_found');

  const scalar: Prisma.TaskUpdateManyMutationInput = {};
  if (input.title !== undefined) scalar.title = input.title;
  if (input.description !== undefined) scalar.description = input.description ?? null;
  if (input.status !== undefined) scalar.status = input.status;
  if (input.priority !== undefined) scalar.priority = input.priority;
  if (input.dueDate !== undefined) scalar.dueDate = input.dueDate ?? null;
  if (Object.keys(scalar).length === 0) scalar.status = before.status; // ensure a locking write

  const res = await ctx.tx.task.updateMany({ where, data: scalar });
  if (res.count !== 1) throw new DomainError('Task not found', 'not_found');

  if (input.assigneeUserId !== undefined) {
    if (input.assigneeUserId) await assertActiveMember(ctx.tx, input.assigneeUserId);
    await ctx.tx.task.update({ where: { id: input.id }, data: { assigneeUserId: input.assigneeUserId ?? null } });
  }
  const after = await ctx.tx.task.findUniqueOrThrow({ where: { id: input.id } });

  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Task', entityId: input.id, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown> });

  if (input.assigneeUserId && input.assigneeUserId !== before.assigneeUserId) {
    await notify(ctx.tx, { userId: input.assigneeUserId, type: 'TASK_ASSIGNED', title: `Task assigned: ${after.title}`, entityType: 'Task', entityId: after.id });
  }
  if (input.status && input.status !== before.status && before.creatorUserId !== ctx.principal.userId) {
    await notify(ctx.tx, { userId: before.creatorUserId, type: 'TASK_STATUS', title: `Task ${input.status}: ${after.title}`, entityType: 'Task', entityId: after.id });
  }

  revalidatePath('/tasks');
  return { id: input.id };
});
