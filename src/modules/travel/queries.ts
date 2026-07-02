import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import { canExecute } from '@/server/workflow/engine';

export interface TravelBooking {
  airline?: string | null;
  flightNo?: string | null;
  departAt?: string | null;
  arriveAt?: string | null;
  price?: number | null;
  currency?: string | null;
  hotelName?: string | null;
  hotelNotes?: string | null;
}

export interface TravelCard {
  id: string;
  status: string;
  requester: string;
  departure: string;
  destination: string;
  hotelNeeded: boolean;
  passengers: string;
  departAt: string | null;
  returnAt: string | null;
  notes: string | null;
  booking: TravelBooking | null;
  canBook: boolean;
}

export async function listTravel(): Promise<TravelCard[]> {
  const principal = await requirePrincipal();
  return withOrgTx(principal.organizationId, async (tx) => {
    const seesAll = principal.roleHints.some((r) => ['AVIATION', 'LEADERSHIP', 'SUPER_ADMIN', 'IT'].includes(r));
    // Visibility enforced in the WHERE — non-privileged callers never pull other
    // requesters' rows (or payloads) out of the database at all.
    const visible = await tx.workflowItem.findMany({
      where: { type: 'TRAVEL', deletedAt: null, ...(seesAll ? {} : { requesterUserId: principal.userId }) },
      orderBy: { createdAt: 'desc' },
      include: { requester: { select: { name: true, email: true } } },
    });

    return visible.map((i) => {
      const p = (i.payload as Record<string, unknown> | null) ?? {};
      const passengers = Array.isArray(p.passengers) ? (p.passengers as Array<{ name: string }>).map((x) => x.name).join(', ') : '—';
      const date = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : null);
      return {
        id: i.id,
        status: i.status,
        requester: i.requester.name ?? i.requester.email ?? '—',
        departure: String(p.departure ?? '—'),
        destination: String(p.destination ?? '—'),
        hotelNeeded: Boolean(p.hotelNeeded),
        passengers,
        departAt: date(p.departAt),
        returnAt: date(p.returnAt),
        notes: (p.notes as string) ?? null,
        booking: (p.booking as TravelBooking) ?? null,
        canBook: canExecute(principal, i),
      };
    });
  });
}
