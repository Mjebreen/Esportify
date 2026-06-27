'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction, type AuthzContext } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import {
  playerCreateSchema,
  playerDeleteSchema,
  playerUpdateSchema,
  type PlayerCreateInput,
  type PlayerDeleteInput,
  type PlayerUpdateInput,
} from '../schema';

/**
 * Create-time FK guard: a roster-scoped creator (Manager) may only place a player
 * on a roster they own; an org-scoped creator (Admin) may use any in-org roster.
 * This runs INSIDE the gate's authorized context — not as a per-handler afterthought.
 */
async function assertRosterPlacement(ctx: AuthzContext, rosterId: string | null): Promise<void> {
  if (ctx.scope === 'roster') {
    if (!rosterId || !ctx.principal.managedRosterIds.includes(rosterId)) {
      throw new DomainError('You can only place players on a roster you manage', 'forbidden_roster');
    }
    return;
  }
  if (rosterId) {
    // RLS guarantees we only see in-org rosters; confirm it exists and is live.
    const roster = await ctx.tx.roster.findFirst({ where: { id: rosterId, deletedAt: null }, select: { id: true } });
    if (!roster) throw new DomainError('Roster not found', 'not_found');
  }
}

export const createPlayer = tenantAction('player', 'create', async (ctx, raw: PlayerCreateInput) => {
  const input = playerCreateSchema.parse(raw);
  const rosterId = input.rosterId ?? null;
  await assertRosterPlacement(ctx, rosterId);

  const player = await ctx.tx.player.create({
    data: {
      organizationId: ctx.principal.organizationId,
      rosterId,
      firstName: input.firstName,
      lastName: input.lastName,
      inGameName: input.inGameName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      jerseyNumber: input.jerseyNumber ?? null,
      status: input.status ?? 'ACTIVE',
      createdById: ctx.principal.userId,
      updatedById: ctx.principal.userId,
    },
  });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'CREATE',
    entity: 'Player',
    entityId: player.id,
    subjectType: 'PLAYER',
    subjectId: player.id,
    after: player as unknown as Record<string, unknown>,
  });

  revalidatePath('/players');
  return { id: player.id };
});

export const updatePlayer = tenantAction('player', 'update', async (ctx, raw: PlayerUpdateInput) => {
  const input = playerUpdateSchema.parse(raw);
  const scope = ctx.where as Prisma.PlayerWhereInput;

  // Snapshot the in-scope target for the audit `before`.
  const before = await ctx.tx.player.findFirst({ where: { id: input.id, deletedAt: null, ...scope } });
  if (!before) throw new DomainError('Player not found', 'not_found');

  // Build the patch. For self-service (scope 'own'), honor the field allowlist from
  // the grant constraints — a Player can never escalate to status/roster/jersey edits.
  // If constraints are missing, `allow` is [] → nothing is settable (fail closed).
  const patch: Prisma.PlayerUpdateManyMutationInput = { updatedById: ctx.principal.userId };
  const allow = ctx.scope === 'own' ? ctx.constraints?.fields ?? [] : null;
  const canSet = (field: string) => allow === null || allow.includes(field);

  if (input.firstName !== undefined && canSet('firstName')) patch.firstName = input.firstName;
  if (input.lastName !== undefined && canSet('lastName')) patch.lastName = input.lastName;
  if (input.phone !== undefined && canSet('phone')) patch.phone = input.phone;
  if (input.email !== undefined && canSet('email')) patch.email = input.email;
  if (input.inGameName !== undefined && canSet('inGameName')) patch.inGameName = input.inGameName;
  if (input.jerseyNumber !== undefined && canSet('jerseyNumber')) patch.jerseyNumber = input.jerseyNumber;
  if (input.status !== undefined && canSet('status')) patch.status = input.status;

  // Validate any roster reassignment up front (throws before any write). rosterId is a
  // relation-scalar FK excluded from updateMany input, so it's applied separately below.
  let nextRosterId: string | null | undefined;
  if (input.rosterId !== undefined && canSet('rosterId')) {
    await assertRosterPlacement(ctx, input.rosterId ?? null);
    nextRosterId = input.rosterId ?? null;
  }

  // Atomic scoped write: the scope predicate is enforced AT WRITE TIME (and this UPDATE
  // takes a row lock held for the tx), so a row that drifts out of scope is not modified.
  const result = await ctx.tx.player.updateMany({ where: { id: input.id, deletedAt: null, ...scope }, data: patch });
  if (result.count !== 1) throw new DomainError('Player not found', 'not_found');

  // The row is now locked + confirmed in-scope within this tx; the FK move is safe.
  if (nextRosterId !== undefined) {
    await ctx.tx.player.update({ where: { id: input.id }, data: { rosterId: nextRosterId } });
  }

  const after = await ctx.tx.player.findUniqueOrThrow({ where: { id: input.id } });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'UPDATE',
    entity: 'Player',
    entityId: after.id,
    subjectType: 'PLAYER',
    subjectId: after.id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  revalidatePath('/players');
  return { id: after.id };
});

export const deletePlayer = tenantAction('player', 'delete', async (ctx, raw: PlayerDeleteInput) => {
  const input = playerDeleteSchema.parse(raw);

  const scope = ctx.where as Prisma.PlayerWhereInput;
  const before = await ctx.tx.player.findFirst({ where: { id: input.id, deletedAt: null, ...scope } });
  if (!before) throw new DomainError('Player not found', 'not_found');

  // Soft delete (recoverable; preserves audit/history). Partial unique index frees the IGN.
  // Scoped updateMany enforces the scope predicate atomically at write time (no TOCTOU).
  const result = await ctx.tx.player.updateMany({
    where: { id: input.id, deletedAt: null, ...scope },
    data: { deletedAt: new Date(), updatedById: ctx.principal.userId },
  });
  if (result.count !== 1) throw new DomainError('Player not found', 'not_found');

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'SOFT_DELETE',
    entity: 'Player',
    entityId: input.id,
    subjectType: 'PLAYER',
    subjectId: input.id,
    before: before as unknown as Record<string, unknown>,
  });

  revalidatePath('/players');
  return { id: input.id };
});
