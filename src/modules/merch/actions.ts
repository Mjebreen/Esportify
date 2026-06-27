'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

// ── Size profiles (one per player) ───────────────────────────────────────────
const profileCreate = z.object({
  playerId: z.string().uuid(),
  jerseySize: z.string().max(12).nullish(),
  jacketSize: z.string().max(12).nullish(),
  shoeSize: z.string().max(12).nullish(),
  notes: z.string().max(500).nullish(),
});
const profileUpdate = z.object({
  id: z.string().uuid(),
  jerseySize: z.string().max(12).nullish(),
  jacketSize: z.string().max(12).nullish(),
  shoeSize: z.string().max(12).nullish(),
  notes: z.string().max(500).nullish(),
});

const profileCrud = crudActions({
  resource: 'merchProfile',
  entity: 'MerchSizeProfile',
  pick: (tx) => tx.merchSizeProfile as unknown as CrudDelegate,
  createSchema: profileCreate,
  updateSchema: profileUpdate,
  buildCreate: (i) => ({
    playerId: i.playerId,
    jerseySize: i.jerseySize ?? null,
    jacketSize: i.jacketSize ?? null,
    shoeSize: i.shoeSize ?? null,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['jerseySize', 'jacketSize', 'shoeSize', 'notes']),
  revalidate: '/merch',
  softDelete: false,
  stampUpdatedBy: true,
  anchor: 'player',
});

export const createMerchProfile = profileCrud.create;
export const updateMerchProfile = profileCrud.update;
export const deleteMerchProfile = profileCrud.remove;

// ── Jersey entitlements (allocated vs claimed) ───────────────────────────────
const jerseyCreate = z.object({
  playerId: z.string().uuid(),
  season: z.string().min(1).max(40),
  allocated: z.coerce.number().int().min(0).optional(),
  claimed: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(500).nullish(),
});
const jerseyUpdate = z.object({
  id: z.string().uuid(),
  season: z.string().min(1).max(40).optional(),
  allocated: z.coerce.number().int().min(0).optional(),
  claimed: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(500).nullish(),
});

const jerseyCrud = crudActions({
  resource: 'jerseyEntitlement',
  entity: 'JerseyEntitlement',
  pick: (tx) => tx.jerseyEntitlement as unknown as CrudDelegate,
  createSchema: jerseyCreate,
  updateSchema: jerseyUpdate,
  buildCreate: (i) => ({
    playerId: i.playerId,
    season: i.season,
    allocated: i.allocated ?? 0,
    claimed: i.claimed ?? 0,
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) => patchFrom(i as Record<string, unknown>, ['season', 'allocated', 'claimed', 'notes']),
  revalidate: '/merch',
  softDelete: false,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createJersey = jerseyCrud.create;
export const updateJersey = jerseyCrud.update;
export const deleteJersey = jerseyCrud.remove;
