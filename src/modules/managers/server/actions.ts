'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import {
  managerCreateSchema,
  managerDeleteSchema,
  managerUpdateSchema,
  type ManagerCreateInput,
  type ManagerDeleteInput,
  type ManagerUpdateInput,
} from '../schema';

export const createManager = tenantAction('manager', 'create', async (ctx, raw: ManagerCreateInput) => {
  const input = managerCreateSchema.parse(raw);
  const manager = await ctx.tx.manager.create({
    data: {
      organizationId: ctx.principal.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      status: input.status ?? 'ACTIVE',
      createdById: ctx.principal.userId,
      updatedById: ctx.principal.userId,
    },
  });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'CREATE',
    entity: 'Manager',
    entityId: manager.id,
    after: manager as unknown as Record<string, unknown>,
  });

  revalidatePath('/managers');
  return { id: manager.id };
});

export const updateManager = tenantAction('manager', 'update', async (ctx, raw: ManagerUpdateInput) => {
  const input = managerUpdateSchema.parse(raw);
  const scope = ctx.where as Prisma.ManagerWhereInput;

  const before = await ctx.tx.manager.findFirst({ where: { id: input.id, deletedAt: null, ...scope } });
  if (!before) throw new DomainError('Manager not found', 'not_found');

  // Field allowlist for any future self-edit grant (scope 'own'); fail closed if missing.
  const patch: Prisma.ManagerUpdateManyMutationInput = { updatedById: ctx.principal.userId };
  const allow = ctx.scope === 'own' ? ctx.constraints?.fields ?? [] : null;
  const canSet = (field: string) => allow === null || allow.includes(field);
  if (input.firstName !== undefined && canSet('firstName')) patch.firstName = input.firstName;
  if (input.lastName !== undefined && canSet('lastName')) patch.lastName = input.lastName;
  if (input.email !== undefined && canSet('email')) patch.email = input.email;
  if (input.status !== undefined && canSet('status')) patch.status = input.status;

  // Atomic scoped write (no TOCTOU): scope predicate enforced at write time.
  const result = await ctx.tx.manager.updateMany({ where: { id: input.id, deletedAt: null, ...scope }, data: patch });
  if (result.count !== 1) throw new DomainError('Manager not found', 'not_found');
  const after = await ctx.tx.manager.findUniqueOrThrow({ where: { id: input.id } });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'UPDATE',
    entity: 'Manager',
    entityId: after.id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  revalidatePath('/managers');
  return { id: after.id };
});

export const deleteManager = tenantAction('manager', 'delete', async (ctx, raw: ManagerDeleteInput) => {
  const input = managerDeleteSchema.parse(raw);

  const scope = ctx.where as Prisma.ManagerWhereInput;
  const before = await ctx.tx.manager.findFirst({ where: { id: input.id, deletedAt: null, ...scope } });
  if (!before) throw new DomainError('Manager not found', 'not_found');

  const result = await ctx.tx.manager.updateMany({
    where: { id: input.id, deletedAt: null, ...scope },
    data: { deletedAt: new Date(), updatedById: ctx.principal.userId },
  });
  if (result.count !== 1) throw new DomainError('Manager not found', 'not_found');

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'SOFT_DELETE',
    entity: 'Manager',
    entityId: input.id,
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath('/managers');
  return { id: input.id };
});
