'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid(),
  matchDate: z.coerce.date(),
  opponent: z.string().max(120).nullish(),
  metric: z.string().min(1).max(60),
  value: z.coerce.number(),
  notes: z.string().max(1000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  matchDate: z.coerce.date().optional(),
  opponent: z.string().max(120).nullish(),
  metric: z.string().min(1).max(60).optional(),
  value: z.coerce.number().optional(),
  notes: z.string().max(1000).nullish(),
});

const crud = crudActions({
  resource: 'performance',
  entity: 'PerformanceRecord',
  pick: (tx) => tx.performanceRecord as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId,
    matchDate: i.matchDate,
    opponent: i.opponent ?? null,
    metric: i.metric,
    value: i.value,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['matchDate', 'opponent', 'metric', 'value', 'notes']),
  revalidate: '/performance',
  softDelete: false,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createPerformance = crud.create;
export const updatePerformance = crud.update;
export const deletePerformance = crud.remove;
