'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import { publicErrorMessage, type ActionResult } from '@/server/action';
import { canExecute, createWorkflow, executeStep } from '@/server/workflow/engine';

const createSchema = z.object({
  passengerIds: z.array(z.string().uuid()).min(1, 'Pick at least one passenger'),
  departure: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  hotelNeeded: z.boolean().optional(),
  departAt: z.coerce.date().nullish(),
  returnAt: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});

/** Team Manager uploads a travel request (1+ passengers). → Esports Manager → Aviation. */
export async function createTravelRequest(raw: z.infer<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const input = createSchema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');

  try {
    const result = await withOrgTx(principal.organizationId, async (tx) => {
      const passengers = await tx.player.findMany({
        where: { id: { in: input.passengerIds }, deletedAt: null },
        select: { id: true, inGameName: true, rosterId: true },
      });
      if (passengers.length !== input.passengerIds.length) throw new Error('Some players not found');
      for (const p of passengers) {
        const owns = p.rosterId && principal.managedRosterIds.includes(p.rosterId);
        if (!owns && !isAdmin) throw new Error('You can only book travel for your own roster');
      }
      const rosterId = passengers[0]!.rosterId;

      return createWorkflow(tx, principal, {
        type: 'TRAVEL',
        title: `Travel to ${input.destination} (${passengers.length} pax)`,
        subjectRosterId: rosterId,
        subjectPlayerId: passengers.length === 1 ? passengers[0]!.id : null,
        payload: {
          passengers: passengers.map((p) => ({ id: p.id, name: p.inGameName })),
          departure: input.departure,
          destination: input.destination,
          hotelNeeded: input.hotelNeeded ?? false,
          departAt: input.departAt ? input.departAt.toISOString() : null,
          returnAt: input.returnAt ? input.returnAt.toISOString() : null,
          notes: input.notes ?? null,
        },
      });
    });
    revalidatePath('/trips');
    revalidatePath('/approvals');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

const bookSchema = z.object({
  id: z.string().uuid(),
  airline: z.string().max(80).optional(),
  flightNo: z.string().max(30).optional(),
  departAt: z.string().max(40).optional(),
  arriveAt: z.string().max(40).optional(),
  price: z.coerce.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  hotelName: z.string().max(120).optional(),
  hotelNotes: z.string().max(500).optional(),
});

/** Aviation books an approved travel request: uploads the flight/hotel data → COMPLETED. */
export async function bookTravel(raw: z.infer<typeof bookSchema>): Promise<ActionResult<{ id: string }>> {
  const input = bookSchema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };

  try {
    await withOrgTx(principal.organizationId, async (tx) => {
      const item = await tx.workflowItem.findFirst({ where: { id: input.id, type: 'TRAVEL', deletedAt: null } });
      if (!item) throw new Error('Travel request not found');
      if (!canExecute(principal, item)) throw new Error('Only Aviation can book an approved request');
      await executeStep(tx, principal, item, {
        booking: {
          airline: input.airline ?? null,
          flightNo: input.flightNo ?? null,
          departAt: input.departAt ?? null,
          arriveAt: input.arriveAt ?? null,
          price: input.price ?? null,
          currency: input.currency ?? null,
          hotelName: input.hotelName ?? null,
          hotelNotes: input.hotelNotes ?? null,
        },
      });
    });
    revalidatePath('/trips');
    revalidatePath('/approvals');
    return { ok: true, data: { id: input.id } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}
