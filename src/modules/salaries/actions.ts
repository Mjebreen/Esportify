'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().min(1).max(8).optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullish(),
  note: z.string().max(500).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  amount: z.coerce.number().nonnegative().optional(),
  currency: z.string().min(1).max(8).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullish(),
  note: z.string().max(500).nullish(),
});

const crud = crudActions({
  resource: 'salary',
  entity: 'Salary',
  pick: (tx) => tx.salary as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId,
    amount: i.amount,
    currency: i.currency ?? 'SAR',
    effectiveFrom: i.effectiveFrom,
    effectiveTo: i.effectiveTo ?? null,
    note: i.note ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['amount', 'currency', 'effectiveFrom', 'effectiveTo', 'note']),
  revalidate: '/salaries',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createSalary = crud.create;
export const updateSalary = crud.update;
export const deleteSalary = crud.remove;
