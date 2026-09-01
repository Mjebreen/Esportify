'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  rosterId: z.string().uuid(),
  kind: z.enum(['SCRIM', 'OFFICIAL']).nullish(),
  opponent: z.string().min(1).max(120),
  ourScore: z.coerce.number().int().min(0).max(999),
  theirScore: z.coerce.number().int().min(0).max(999),
  playedAt: z.coerce.date(),
  notes: z.string().max(1000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['SCRIM', 'OFFICIAL']).nullish(),
  opponent: z.string().min(1).max(120).optional(),
  ourScore: z.coerce.number().int().min(0).max(999).optional(),
  theirScore: z.coerce.number().int().min(0).max(999).optional(),
  playedAt: z.coerce.date().optional(),
  notes: z.string().max(1000).nullish(),
});

const crud = crudActions({
  resource: 'matchResult',
  entity: 'MatchResult',
  pick: (tx) => tx.matchResult as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    rosterId: i.rosterId,
    kind: i.kind ?? 'SCRIM',
    opponent: i.opponent,
    ourScore: i.ourScore,
    theirScore: i.theirScore,
    playedAt: i.playedAt,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => {
    const patch = patchFrom(i as Record<string, unknown>, ['kind', 'opponent', 'ourScore', 'theirScore', 'playedAt', 'notes']);
    if (patch.kind == null) delete patch.kind; // non-null defaulted column: empty = no change
    return patch;
  },
  revalidate: '/results',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'roster',
  anchorField: 'rosterId',
});

export const createResult = crud.create;
export const updateResult = crud.update;
export const deleteResult = crud.remove;
