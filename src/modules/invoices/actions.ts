'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid(),
  number: z.string().min(1).max(60),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().min(1).max(8).optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']).optional(),
  issuedAt: z.coerce.date(),
  dueAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  number: z.string().min(1).max(60).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  currency: z.string().min(1).max(8).optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']).optional(),
  issuedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});

const crud = crudActions({
  resource: 'invoice',
  entity: 'Invoice',
  pick: (tx) => tx.invoice as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId,
    number: i.number,
    amount: i.amount,
    currency: i.currency ?? 'SAR',
    status: i.status ?? 'SENT',
    issuedAt: i.issuedAt,
    dueAt: i.dueAt ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['number', 'amount', 'currency', 'status', 'issuedAt', 'dueAt', 'notes']),
  revalidate: '/invoices',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createInvoice = crud.create;
export const updateInvoice = crud.update;
export const deleteInvoice = crud.remove;
