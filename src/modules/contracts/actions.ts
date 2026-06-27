'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  salaryAmount: z.coerce.number().nonnegative().nullish(),
  currency: z.string().min(1).max(8).optional(),
  buyout: z.coerce.number().nonnegative().nullish(),
  prizeSplitPct: z.coerce.number().min(0).max(100).nullish(),
  notes: z.string().max(2000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  salaryAmount: z.coerce.number().nonnegative().nullish(),
  currency: z.string().min(1).max(8).optional(),
  buyout: z.coerce.number().nonnegative().nullish(),
  prizeSplitPct: z.coerce.number().min(0).max(100).nullish(),
  notes: z.string().max(2000).nullish(),
});

const crud = crudActions({
  resource: 'contract',
  entity: 'Contract',
  pick: (tx) => tx.contract as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId,
    status: i.status ?? 'DRAFT',
    startDate: i.startDate,
    endDate: i.endDate,
    salaryAmount: i.salaryAmount ?? null,
    currency: i.currency ?? 'SAR',
    buyout: i.buyout ?? null,
    prizeSplitPct: i.prizeSplitPct ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) =>
    patchFrom(i as Record<string, unknown>, ['status', 'startDate', 'endDate', 'salaryAmount', 'currency', 'buyout', 'prizeSplitPct', 'notes']),
  revalidate: '/contracts',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createContract = crud.create;
export const updateContract = crud.update;
export const deleteContract = crud.remove;
