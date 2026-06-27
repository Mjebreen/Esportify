'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid(),
  type: z.enum(['ABSENCE', 'TARDINESS']),
  date: z.coerce.date(),
  minutesLate: z.coerce.number().int().min(0).nullish(),
  reason: z.string().max(500).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['ABSENCE', 'TARDINESS']).optional(),
  date: z.coerce.date().optional(),
  minutesLate: z.coerce.number().int().min(0).nullish(),
  reason: z.string().max(500).nullish(),
});

const crud = crudActions({
  resource: 'attendance',
  entity: 'Attendance',
  pick: (tx) => tx.attendance as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId,
    type: i.type,
    date: i.date,
    minutesLate: i.minutesLate ?? null,
    reason: i.reason ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['type', 'date', 'minutesLate', 'reason']),
  revalidate: '/attendance',
  softDelete: false,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createAttendance = crud.create;
export const updateAttendance = crud.update;
export const deleteAttendance = crud.remove;
