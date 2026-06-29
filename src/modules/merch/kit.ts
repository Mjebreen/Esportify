'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import type { ActionResult } from '@/server/action';
import { createWorkflow } from '@/server/workflow/engine';

const schema = z.object({
  playerId: z.string().uuid(),
  jerseyName: z.string().min(1).max(40),
  kitType: z.enum(['JERSEY', 'JACKET', 'TRAINING', 'OTHER']).optional(),
  size: z.string().max(12).optional(),
});

/**
 * Submit a kit request (jersey/kit with a desired printed name).
 *  - Player submitting for themselves → needs their Team Manager's approval → Merch.
 *  - Manager submitting for a roster player → straight to Merch (the manager IS the approver).
 * Bounded by the player's Merch-set entitlement (allocated − claimed − pending).
 */
export async function submitKitRequest(raw: z.infer<typeof schema>): Promise<ActionResult<{ id: string }>> {
  const input = schema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };

  try {
    const result = await withOrgTx(principal.organizationId, async (tx) => {
      const player = await tx.player.findFirst({
        where: { id: input.playerId, deletedAt: null },
        select: { id: true, inGameName: true, rosterId: true, userId: true },
      });
      if (!player) throw new Error('Player not found');

      const isSelf = player.userId === principal.userId;
      const isManager = !!player.rosterId && principal.managedRosterIds.includes(player.rosterId);
      const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
      if (!isSelf && !isManager && !isAdmin) throw new Error('You can only request kit for yourself or your roster');

      // Entitlement (allowance) check.
      const season = String(new Date().getFullYear());
      const ent = await tx.jerseyEntitlement.findFirst({ where: { playerId: player.id, season }, select: { allocated: true, claimed: true } });
      const allowed = ent?.allocated ?? 0;
      if (allowed <= 0) throw new Error('Merch has not set a kit allowance for this player yet');
      const pending = await tx.workflowItem.count({
        where: { type: 'MERCH_KIT', subjectPlayerId: player.id, status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } },
      });
      if ((ent?.claimed ?? 0) + pending >= allowed) {
        throw new Error(`Kit allowance reached (${allowed} for ${season})`);
      }

      // A self-requesting player with no roster has no Team Manager to approve it —
      // the item would sit PENDING forever. Block it with a clear message.
      if (isSelf && !isManager && !player.rosterId) throw new Error('You must be on a roster before requesting kit');

      // Player self-request → Team Manager approval. Manager/admin request → no approval step.
      const chain = isSelf && !isManager ? undefined : ([] as never[]);
      return createWorkflow(tx, principal, {
        type: 'MERCH_KIT',
        title: `Kit "${input.jerseyName}" · ${player.inGameName}`,
        subjectPlayerId: player.id,
        subjectRosterId: player.rosterId,
        payload: { jerseyName: input.jerseyName, kitType: input.kitType ?? 'JERSEY', size: input.size ?? null, season },
        chain,
      });
    });

    revalidatePath('/merch');
    revalidatePath('/approvals');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
