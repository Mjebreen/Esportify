'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';

const addSchema = z.object({
  contractId: z.string().uuid(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
});

/** Add a clause to a contract the caller can update (manager scope = their roster). */
export const addClause = tenantAction('contract', 'update', async (ctx, raw: z.infer<typeof addSchema>) => {
  const input = addSchema.parse(raw);
  const contract = await ctx.tx.contract.findFirst({
    where: { id: input.contractId, deletedAt: null, ...(ctx.where as Prisma.ContractWhereInput) },
    select: { id: true },
  });
  if (!contract) throw new DomainError('Contract not found', 'not_found');

  const clause = await ctx.tx.contractClause.create({
    data: { organizationId: ctx.principal.organizationId, contractId: contract.id, title: input.title, body: input.body },
  });
  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'CREATE',
    entity: 'ContractClause',
    entityId: clause.id,
    after: clause as unknown as Record<string, unknown>,
  });
  revalidatePath(`/contracts/${contract.id}`);
  return { id: clause.id };
});

export const deleteClause = tenantAction('contract', 'update', async (ctx, raw: { id: string; contractId: string }) => {
  // The clause's parent contract must be within the caller's scope.
  const res = await ctx.tx.contractClause.deleteMany({
    where: { id: raw.id, contract: { deletedAt: null, ...(ctx.where as Prisma.ContractWhereInput) } },
  });
  if (res.count !== 1) throw new DomainError('Clause not found', 'not_found');
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'DELETE', entity: 'ContractClause', entityId: raw.id });
  revalidatePath(`/contracts/${raw.contractId}`);
  return { id: raw.id };
});
