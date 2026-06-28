'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';

const addSchema = z.object({
  tripId: z.string().uuid(),
  airline: z.string().max(80).nullish(),
  flightNo: z.string().max(20).nullish(),
  departAt: z.coerce.date().nullish(),
  arriveAt: z.coerce.date().nullish(),
  price: z.coerce.number().nonnegative().nullish(),
  currency: z.string().max(8).nullish(),
});

async function tripInScope(ctx: { tx: Prisma.TransactionClient; where: unknown }, tripId: string) {
  const trip = await ctx.tx.trip.findFirst({
    where: { id: tripId, deletedAt: null, ...(ctx.where as Prisma.TripWhereInput) },
    select: { id: true },
  });
  if (!trip) throw new DomainError('Trip not found', 'not_found');
  return trip.id;
}

export const addFlight = tenantAction('trip', 'update', async (ctx, raw: z.infer<typeof addSchema>) => {
  const input = addSchema.parse(raw);
  await tripInScope(ctx, input.tripId);
  const flight = await ctx.tx.flightOption.create({
    data: {
      organizationId: ctx.principal.organizationId,
      tripId: input.tripId,
      airline: input.airline ?? null,
      flightNo: input.flightNo ?? null,
      departAt: input.departAt ?? null,
      arriveAt: input.arriveAt ?? null,
      price: input.price ?? null,
      currency: input.currency ?? null,
    },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'CREATE', entity: 'FlightOption', entityId: flight.id, after: flight as unknown as Record<string, unknown> });
  revalidatePath(`/trips/${input.tripId}`);
  return { id: flight.id };
});

export const deleteFlight = tenantAction('trip', 'update', async (ctx, raw: { id: string; tripId: string }) => {
  const res = await ctx.tx.flightOption.deleteMany({
    where: { id: raw.id, trip: { deletedAt: null, ...(ctx.where as Prisma.TripWhereInput) } },
  });
  if (res.count !== 1) throw new DomainError('Flight not found', 'not_found');
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'DELETE', entity: 'FlightOption', entityId: raw.id });
  revalidatePath(`/trips/${raw.tripId}`);
  return { id: raw.id };
});

/** Select a flight: mark it chosen, unmark the rest, and move the trip to BOOKED. */
export const selectFlight = tenantAction('trip', 'update', async (ctx, raw: { id: string; tripId: string }) => {
  await tripInScope(ctx, raw.tripId);
  const target = await ctx.tx.flightOption.findFirst({ where: { id: raw.id, tripId: raw.tripId }, select: { id: true } });
  if (!target) throw new DomainError('Flight not found', 'not_found');

  await ctx.tx.flightOption.updateMany({ where: { tripId: raw.tripId }, data: { selected: false } });
  await ctx.tx.flightOption.update({ where: { id: raw.id }, data: { selected: true } });
  await ctx.tx.trip.updateMany({ where: { id: raw.tripId, ...(ctx.where as Prisma.TripWhereInput) }, data: { status: 'BOOKED' } });

  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Trip', entityId: raw.tripId, after: { selectedFlight: raw.id } });
  revalidatePath(`/trips/${raw.tripId}`);
  return { id: raw.id };
});
