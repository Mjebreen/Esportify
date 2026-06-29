'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction, type AuthzContext } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { authorize, holdsGrant } from '@/server/authz/gate';
import { notify } from '@/server/notify/notify';

/** Segregation of duties: the player's MANAGER (roster scope) approves/rejects, NOT
 * finance (org scope). Admins (SUPER_ADMIN/IT) retain their override. */
function assertManagerStep(ctx: AuthzContext): void {
  const isAdmin = ctx.principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  const d = authorize(ctx.principal, 'update', 'invoice');
  if (d.allowed && d.scope === 'organization' && !isAdmin) {
    throw new DomainError("Only the player's manager can approve or reject invoices", 'forbidden');
  }
}

const submitSchema = z.object({
  number: z.string().min(1).max(60),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().min(1).max(8).optional(),
  dueAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});

/** PLAYER uploads an invoice for themselves → status SUBMITTED (awaiting manager). */
export const submitInvoice = tenantAction('invoice', 'create', async (ctx, raw: z.infer<typeof submitSchema>) => {
  const input = submitSchema.parse(raw);
  if (!ctx.principal.playerId) throw new DomainError('Only players can upload their own invoices', 'not_a_player');

  const invoice = await ctx.tx.invoice.create({
    data: {
      organizationId: ctx.principal.organizationId,
      playerId: ctx.principal.playerId,
      number: input.number,
      amount: input.amount,
      currency: input.currency ?? 'SAR',
      status: 'SUBMITTED',
      issuedAt: new Date(),
      dueAt: input.dueAt ?? null,
      notes: input.notes ?? null,
      createdById: ctx.principal.userId,
    },
  });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'CREATE',
    entity: 'Invoice',
    entityId: invoice.id,
    subjectType: 'PLAYER',
    subjectId: ctx.principal.playerId,
    after: { number: invoice.number, status: 'SUBMITTED' },
  });

  // Notify the player's roster manager that an invoice awaits approval.
  const player = await ctx.tx.player.findFirst({
    where: { id: ctx.principal.playerId },
    select: { roster: { select: { manager: { select: { userId: true } } } } },
  });
  await notify(ctx.tx, {
    userId: player?.roster?.manager?.userId ?? null,
    type: 'GENERIC',
    title: `Invoice ${invoice.number} submitted for approval`,
    entityType: 'Invoice',
    entityId: invoice.id,
  });

  revalidatePath('/invoices');
  return { id: invoice.id };
});

async function loadInScope(ctx: AuthzContext, id: string, status: string) {
  const inv = await ctx.tx.invoice.findFirst({
    where: { id, deletedAt: null, status: status as Prisma.InvoiceWhereInput['status'], ...(ctx.where as Prisma.InvoiceWhereInput) },
    select: { id: true, number: true, createdById: true },
  });
  if (!inv) throw new DomainError('Invoice not found or not in the right state', 'invalid_state');
  return inv;
}

/** MANAGER approves a SUBMITTED invoice → MANAGER_APPROVED (goes to finance). */
export const approveInvoice = tenantAction('invoice', 'update', async (ctx, raw: { id: string }) => {
  assertManagerStep(ctx);
  const before = await loadInScope(ctx, raw.id, 'SUBMITTED');
  await ctx.tx.invoice.updateMany({
    where: { id: raw.id, status: 'SUBMITTED', ...(ctx.where as Prisma.InvoiceWhereInput) },
    data: { status: 'MANAGER_APPROVED', approvedById: ctx.principal.userId, approvedAt: new Date() },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Invoice', entityId: raw.id, after: { status: 'MANAGER_APPROVED' } });
  await notify(ctx.tx, { userId: before.createdById, type: 'GENERIC', title: `Invoice ${before.number} approved — sent to finance`, entityType: 'Invoice', entityId: raw.id });
  revalidatePath('/invoices');
  return { id: raw.id };
});

const rejectSchema = z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() });

/** MANAGER rejects a SUBMITTED invoice → REJECTED. */
export const rejectInvoice = tenantAction('invoice', 'update', async (ctx, raw: z.infer<typeof rejectSchema>) => {
  assertManagerStep(ctx);
  const input = rejectSchema.parse(raw);
  const before = await loadInScope(ctx, input.id, 'SUBMITTED');
  await ctx.tx.invoice.updateMany({
    where: { id: input.id, status: 'SUBMITTED', ...(ctx.where as Prisma.InvoiceWhereInput) },
    data: { status: 'REJECTED', rejectionReason: input.reason ?? null },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Invoice', entityId: input.id, after: { status: 'REJECTED', reason: input.reason ?? null } });
  await notify(ctx.tx, { userId: before.createdById, type: 'GENERIC', title: `Invoice ${before.number} was rejected`, body: input.reason ?? null, entityType: 'Invoice', entityId: input.id });
  revalidatePath('/invoices');
  return { id: input.id };
});

/** FINANCE (org-scope) pays a MANAGER_APPROVED invoice → PAID. */
export const payInvoice = tenantAction('invoice', 'update', async (ctx, raw: { id: string }) => {
  if (!holdsGrant(ctx.principal, 'invoice', 'update', 'organization')) {
    throw new DomainError('Only finance can pay invoices', 'forbidden');
  }
  const before = await loadInScope(ctx, raw.id, 'MANAGER_APPROVED');
  await ctx.tx.invoice.updateMany({
    where: { id: raw.id, status: 'MANAGER_APPROVED', ...(ctx.where as Prisma.InvoiceWhereInput) },
    data: { status: 'PAID', paidAt: new Date() },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Invoice', entityId: raw.id, after: { status: 'PAID' } });
  await notify(ctx.tx, { userId: before.createdById, type: 'GENERIC', title: `Invoice ${before.number} was paid`, entityType: 'Invoice', entityId: raw.id });
  revalidatePath('/invoices');
  return { id: raw.id };
});
