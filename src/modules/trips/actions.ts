'use server';

import { z } from 'zod';
import { crudActions, patchFrom, type CrudDelegate } from '@/server/crud/factory';

const createSchema = z.object({
  playerId: z.string().uuid().nullish(),
  purpose: z.string().min(1).max(160),
  origin: z.string().max(120).nullish(),
  destination: z.string().max(120).nullish(),
  departAt: z.coerce.date().nullish(),
  returnAt: z.coerce.date().nullish(),
  status: z.enum(['REQUESTED', 'BOOKED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(1000).nullish(),
});
const updateSchema = z.object({
  id: z.string().uuid(),
  purpose: z.string().min(1).max(160).optional(),
  origin: z.string().max(120).nullish(),
  destination: z.string().max(120).nullish(),
  departAt: z.coerce.date().nullish(),
  returnAt: z.coerce.date().nullish(),
  status: z.enum(['REQUESTED', 'BOOKED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(1000).nullish(),
});

const crud = crudActions({
  resource: 'trip',
  entity: 'Trip',
  pick: (tx) => tx.trip as unknown as CrudDelegate,
  createSchema,
  updateSchema,
  buildCreate: (i) => ({
    playerId: i.playerId ?? null,
    purpose: i.purpose,
    origin: i.origin ?? null,
    destination: i.destination ?? null,
    departAt: i.departAt ?? null,
    returnAt: i.returnAt ?? null,
    status: i.status ?? 'REQUESTED',
    notes: i.notes ?? null,
  }),
  buildUpdate: (i) =>
    patchFrom(i as Record<string, unknown>, ['purpose', 'origin', 'destination', 'departAt', 'returnAt', 'status', 'notes']),
  revalidate: '/trips',
  softDelete: true,
  stampCreatedBy: true,
  anchor: 'player',
});

export const createTrip = crud.create;
export const updateTrip = crud.update;
export const deleteTrip = crud.remove;
