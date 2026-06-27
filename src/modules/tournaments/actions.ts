'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  name: z.string().min(1).max(160),
  gameTitleId: z.string().uuid(),
  rosterId: z.string().uuid().nullish(),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  placement: z.coerce.number().int().min(1).nullish(),
  prizePool: z.coerce.number().nonnegative().nullish(),
  prizeCurrency: z.string().max(8).nullish(),
  notes: z.string().max(2000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  placement: z.coerce.number().int().min(1).nullish(),
  prizePool: z.coerce.number().nonnegative().nullish(),
  prizeCurrency: z.string().max(8).nullish(),
  notes: z.string().max(2000).nullish(),
});

const crud = crudActions({
  resource: 'tournament',
  entity: 'Tournament',
  pick: (tx) => tx.tournament as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    name: i.name,
    gameTitleId: i.gameTitleId,
    rosterId: i.rosterId ?? null,
    status: i.status ?? 'UPCOMING',
    startDate: i.startDate,
    endDate: i.endDate ?? null,
    placement: i.placement ?? null,
    prizePool: i.prizePool ?? null,
    prizeCurrency: i.prizeCurrency ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) =>
    patchFrom(i as Record<string, unknown>, ['name', 'status', 'startDate', 'endDate', 'placement', 'prizePool', 'prizeCurrency', 'notes']),
  revalidate: '/tournaments',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'roster',
  anchorField: 'rosterId',
});

export const createTournament = crud.create;
export const updateTournament = crud.update;
export const deleteTournament = crud.remove;
