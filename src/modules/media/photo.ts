'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import type { ActionResult } from '@/server/action';
import { createWorkflow } from '@/server/workflow/engine';

const schema = z.object({
  rosterId: z.string().uuid(),
  kind: z.enum(['PHOTOSHOOT', 'MEDIA_DAY', 'CONTENT', 'OTHER']),
  event: z.string().max(160).optional(),
  deadline: z.coerce.date().nullish(),
  notes: z.string().max(1000).nullish(),
});

/**
 * Photography request for a roster.
 *  - Manager-initiated → Esports Manager approves → Marcom.
 *  - Marcom-initiated  → Esports Manager approves → the roster's Team Manager
 *    approves → Marcom (it's their roster).
 */
export async function createPhotoRequest(raw: z.infer<typeof schema>): Promise<ActionResult<{ id: string }>> {
  const input = schema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };

  const isManager = principal.managedRosterIds.includes(input.rosterId);
  const isMarcom = principal.roleHints.includes('MARCOM');
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  if (!isManager && !isMarcom && !isAdmin) return { ok: false, error: 'Only the roster manager or Marcom can request a shoot' };

  try {
    const result = await withOrgTx(principal.organizationId, async (tx) => {
      const roster = await tx.roster.findFirst({ where: { id: input.rosterId, deletedAt: null }, select: { name: true } });
      if (!roster) throw new Error('Roster not found');

      // Marcom-initiated needs the team manager to also sign off.
      const chain = isMarcom && !isManager ? (['ESPORTS_MANAGER', 'TEAM_MANAGER'] as const) : undefined;
      return createWorkflow(tx, principal, {
        type: 'PHOTO',
        title: `${input.kind.replace('_', ' ')} · ${roster.name}`,
        subjectRosterId: input.rosterId,
        payload: {
          kind: input.kind,
          event: input.event ?? null,
          deadline: input.deadline ? input.deadline.toISOString() : null,
          notes: input.notes ?? null,
          rosterName: roster.name,
        },
        chain: chain ? [...chain] : undefined,
      });
    });
    revalidatePath('/media');
    revalidatePath('/approvals');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
