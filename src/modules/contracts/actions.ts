'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

// CrudManager sends null (not undefined) for empty non-required fields, so optional
// enum/string fields must be .nullish(); buildCreate coalesces null → default and
// buildUpdate drops null for the defaulted, non-null columns (status/currency).
const createSchema = z.object({
  playerId: z.string().uuid(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  salaryAmount: z.coerce.number().nonnegative().nullish(),
  currency: z.string().min(1).max(8).nullish(),
  buyout: z.coerce.number().nonnegative().nullish(),
  prizeSplitPct: z.coerce.number().min(0).max(100).nullish(),
  notes: z.string().max(2000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).nullish(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  salaryAmount: z.coerce.number().nonnegative().nullish(),
  currency: z.string().min(1).max(8).nullish(),
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
  buildUpdate: (i) => {
    const patch = patchFrom(i as Record<string, unknown>, ['status', 'startDate', 'endDate', 'salaryAmount', 'currency', 'buyout', 'prizeSplitPct', 'notes']);
    if (patch.status == null) delete patch.status; // non-null defaulted column: empty = no change
    if (patch.currency == null) delete patch.currency;
    return patch;
  },
  revalidate: '/contracts',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createContract = crud.create;
export const updateContract = crud.update;
export const deleteContract = crud.remove;
