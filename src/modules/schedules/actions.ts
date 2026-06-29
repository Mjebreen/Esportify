'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  rosterId: z.string().uuid().nullish(),
  type: z.enum(['PRACTICE', 'SCRIM', 'MEETING', 'REVIEW', 'PHOTOSHOOT', 'MEDIA_DAY', 'OTHER']).optional(),
  title: z.string().min(1).max(160),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['PRACTICE', 'SCRIM', 'MEETING', 'REVIEW', 'PHOTOSHOOT', 'MEDIA_DAY', 'OTHER']).optional(),
  title: z.string().min(1).max(160).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});

const crud = crudActions({
  resource: 'schedule',
  entity: 'Schedule',
  pick: (tx) => tx.schedule as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    rosterId: i.rosterId ?? null,
    type: i.type ?? 'PRACTICE',
    title: i.title,
    startAt: i.startAt,
    endAt: i.endAt ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['type', 'title', 'startAt', 'endAt', 'notes']),
  revalidate: '/schedule',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'roster',
  anchorField: 'rosterId',
});

export const createSchedule = crud.create;
export const updateSchedule = crud.update;
export const deleteSchedule = crud.remove;
