'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import { publicErrorMessage, type ActionResult } from '@/server/action';
import { createWorkflow } from '@/server/workflow/engine';

const schema = z.object({
  playerId: z.string().uuid(),
  kind: z.enum(['WINNING', 'CUT']),
  amount: z.coerce.number().positive().max(1_000_000),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  currency: z.string().min(1).max(8).optional(),
  reason: z.string().max(500).nullish(),
});

/**
 * Add a monthly salary adjustment (winning or cut) for a roster player.
 * Manager (of the player's roster) or admin only. Each line routes to the Esports
 * Manager for approval; once approved it feeds the player's monthly payroll total
 * that Finance pays. The contract base salary is left untouched.
 */
export async function addSalaryAdjustment(raw: z.infer<typeof schema>): Promise<ActionResult<{ id: string }>> {
  const input = schema.parse(raw);
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false, error: 'Not authenticated' };

  try {
    const result = await withOrgTx(principal.organizationId, async (tx) => {
      const player = await tx.player.findFirst({
        where: { id: input.playerId, deletedAt: null },
        select: { id: true, inGameName: true, rosterId: true },
      });
      if (!player) throw new Error('Player not found');

      const isManager = !!player.rosterId && principal.managedRosterIds.includes(player.rosterId);
      const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
      if (!isManager && !isAdmin) throw new Error('You can only adjust salaries for your own roster');

      const currency = input.currency ?? 'SAR';
      const sign = input.kind === 'WINNING' ? '+' : '−';
      return createWorkflow(tx, principal, {
        type: 'SALARY_ADJUSTMENT',
        title: `${input.kind === 'WINNING' ? 'Winning' : 'Cut'} ${sign}${input.amount} ${currency} · ${player.inGameName} · ${input.period}`,
        subjectPlayerId: player.id,
        subjectRosterId: player.rosterId,
        payload: {
          kind: input.kind,
          amount: input.amount,
          currency,
          period: input.period,
          reason: input.reason ?? null,
          playerName: player.inGameName,
        },
      });
    });

    revalidatePath('/salaries');
    revalidatePath('/approvals');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}
