import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface FlightRow {
  id: string;
  airline: string | null;
  flightNo: string | null;
  departAt: string | null;
  arriveAt: string | null;
  price: string | null;
  currency: string | null;
  selected: boolean;
}
export interface TripDetail {
  id: string;
  player: string | null;
  purpose: string;
  origin: string | null;
  destination: string | null;
  departAt: string | null;
  returnAt: string | null;
  status: string;
  notes: string | null;
  flights: FlightRow[];
}

const dt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : null);

export async function getTripDetail(id: string): Promise<TripDetail | null> {
  return tenantLoad('trip', 'read', async ({ tx, where }) => {
    const t = await tx.trip.findFirst({
      where: { id, deletedAt: null, ...(where as Prisma.TripWhereInput) },
      select: {
        id: true,
        purpose: true,
        origin: true,
        destination: true,
        departAt: true,
        returnAt: true,
        status: true,
        notes: true,
        player: { select: { inGameName: true } },
        flights: {
          orderBy: { price: 'asc' },
          select: { id: true, airline: true, flightNo: true, departAt: true, arriveAt: true, price: true, currency: true, selected: true },
        },
      },
    });
    if (!t) return null;
    return {
      id: t.id,
      player: t.player?.inGameName ?? null,
      purpose: t.purpose,
      origin: t.origin,
      destination: t.destination,
      departAt: dt(t.departAt),
      returnAt: dt(t.returnAt),
      status: t.status,
      notes: t.notes,
      flights: t.flights.map((f) => ({
        id: f.id,
        airline: f.airline,
        flightNo: f.flightNo,
        departAt: dt(f.departAt),
        arriveAt: dt(f.arriveAt),
        price: f.price ? f.price.toString() : null,
        currency: f.currency,
        selected: f.selected,
      })),
    };
  });
}
