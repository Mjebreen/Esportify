'use server';

import { z } from 'zod';
import { DomainError } from '@/server/action';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const ATTENDANCE_TYPES = ['PRESENT', 'ABSENCE', 'TARDINESS', 'EXCUSED'] as const;

const createSchema = z.object({
  playerId: z.string().uuid(),
  scheduleId: z.string().uuid().nullish(),
  type: z.enum(ATTENDANCE_TYPES),
  date: z.coerce.date(),
  minutesLate: z.coerce.number().int().min(0).nullish(),
  reason: z.string().max(500).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid().nullish(),
  type: z.enum(ATTENDANCE_TYPES).optional(),
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
    scheduleId: i.scheduleId ?? null,
    type: i.type,
    date: i.date,
    minutesLate: i.minutesLate ?? null,
    reason: i.reason ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['scheduleId', 'type', 'date', 'minutesLate', 'reason']),
  revalidate: '/attendance',
  softDelete: false,
  stampCreatedBy: true,
  anchor: 'player',
  // A linked session must be within the caller's roster scope (not just same-org).
  validate: async (ctx, data) => {
    const sid = data.scheduleId;
    if (typeof sid !== 'string') return;
    const where = ctx.scope === 'roster' ? { id: sid, roster: { managerId: ctx.principal.managerId } } : { id: sid };
    const found = await ctx.tx.schedule.findFirst({ where, select: { id: true } });
    if (!found) throw new DomainError('Practice session not in your scope', 'forbidden_scope');
  },
});

export const createAttendance = crud.create;
export const updateAttendance = crud.update;
export const deleteAttendance = crud.remove;
