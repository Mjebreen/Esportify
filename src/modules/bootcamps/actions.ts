'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  name: z.string().min(1).max(160),
  location: z.string().max(160).nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  notes: z.string().max(2000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  location: z.string().max(160).nullish(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  notes: z.string().max(2000).nullish(),
});

const crud = crudActions({
  resource: 'bootcamp',
  entity: 'Bootcamp',
  pick: (tx) => tx.bootcamp as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    name: i.name,
    location: i.location ?? null,
    startDate: i.startDate,
    endDate: i.endDate ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['name', 'location', 'startDate', 'endDate', 'notes']),
  revalidate: '/bootcamps',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'none',
});

export const createBootcamp = crud.create;
export const updateBootcamp = crud.update;
export const deleteBootcamp = crud.remove;
