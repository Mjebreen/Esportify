import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { DomainError, tenantAction, tenantLoad, type AuthzContext } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import type { Action, Resource, ScopeWhere } from '@/server/authz/types';
import type { TxClient } from '@/server/db/tenant';

/**
 * Structural view of a Prisma model delegate — enough for generic CRUD without
 * threading per-model generics. Casts to this happen at the one boundary in pick().
 */
export interface CrudDelegate {
  findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  findUniqueOrThrow(args: unknown): Promise<Record<string, unknown>>;
}
type Delegate = CrudDelegate;

export type ScopeAnchor = 'none' | 'player' | 'roster';

export interface CrudDef<C, U extends { id: string }> {
  resource: Resource;
  entity: string;
  /** Returns the model delegate from a tx, e.g. `(tx) => tx.salary`. */
  pick: (tx: TxClient) => Delegate;
  createSchema: z.ZodType<C>;
  updateSchema: z.ZodType<U>;
  /** Map validated create input → Prisma scalar data (no org/audit stamps). */
  buildCreate: (input: C) => Record<string, unknown>;
  /** Map validated update input (sans id) → Prisma scalar patch. */
  buildUpdate: (input: Omit<U, 'id'>) => Record<string, unknown>;
  revalidate: string;
  softDelete: boolean;
  stampCreatedBy?: boolean;
  stampUpdatedBy?: boolean;
  /** Validate the create input's anchor FK is within the caller's scope. */
  anchor?: ScopeAnchor;
  /** Field holding the anchor id (default 'playerId'). */
  anchorField?: string;
  subjectType?: string;
}

/** Confirm the anchor entity (player/roster) referenced on create is in scope. */
async function assertAnchorInScope(ctx: AuthzContext, anchor: ScopeAnchor, id: unknown): Promise<void> {
  if (anchor === 'none') return;
  if (typeof id !== 'string') {
    // No anchor supplied: only allowed for org-scoped callers (admins); a roster/own
    // caller MUST anchor to something they own.
    if (ctx.scope === 'organization') return;
    throw new DomainError('A roster/player reference is required', 'invalid');
  }

  if (anchor === 'player') {
    const where =
      ctx.scope === 'roster'
        ? { id, roster: { managerId: ctx.principal.managerId } }
        : ctx.scope === 'own'
          ? { id, userId: ctx.principal.userId }
          : { id };
    const found = await ctx.tx.player.findFirst({ where, select: { id: true } });
    if (!found) throw new DomainError('Player not in your scope', 'forbidden_scope');
  } else {
    const where = ctx.scope === 'roster' ? { id, managerId: ctx.principal.managerId } : { id };
    const found = await ctx.tx.roster.findFirst({ where, select: { id: true } });
    if (!found) throw new DomainError('Roster not in your scope', 'forbidden_scope');
  }
}

function liveFilter(softDelete: boolean): ScopeWhere {
  return softDelete ? { deletedAt: null } : {};
}

/** Copy the provided keys (including explicit nulls; skipping undefined) into a patch. */
export function patchFrom(input: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (input[k] !== undefined) out[k] = input[k];
  return out;
}

export function crudActions<C, U extends { id: string }>(def: CrudDef<C, U>) {
  const subjectFor = (row: Record<string, unknown>) =>
    def.anchor === 'player'
      ? { subjectType: 'PLAYER' as const, subjectId: (row[def.anchorField ?? 'playerId'] as string) ?? null }
      : {};

  const create = tenantAction(def.resource, 'create', async (ctx, raw: C) => {
    const input = def.createSchema.parse(raw);
    const data = def.buildCreate(input);
    if (def.anchor && def.anchor !== 'none') {
      await assertAnchorInScope(ctx, def.anchor, data[def.anchorField ?? 'playerId']);
    }

    let row: Record<string, unknown>;
    try {
      row = await def.pick(ctx.tx).create({
        data: {
          ...data,
          organizationId: ctx.principal.organizationId,
          ...(def.stampCreatedBy ? { createdById: ctx.principal.userId } : {}),
        },
      });
    } catch (err) {
      // e.g. a MerchSizeProfile already exists for this player (unique constraint).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError('That record already exists', 'conflict');
      }
      throw err;
    }
    await writeAudit(ctx.tx, {
      actorUserId: ctx.principal.userId,
      action: 'CREATE',
      entity: def.entity,
      entityId: row.id as string,
      after: row,
      ...subjectFor(row),
    });
    revalidatePath(def.revalidate);
    return { id: row.id as string };
  });

  const update = tenantAction(def.resource, 'update', async (ctx, raw: U) => {
    const input = def.updateSchema.parse(raw);
    const where = { id: input.id, ...liveFilter(def.softDelete), ...ctx.where };
    const before = await def.pick(ctx.tx).findFirst({ where });
    if (!before) throw new DomainError('Not found', 'not_found');

    const { id: _id, ...rest } = input as U & Record<string, unknown>;
    const data = { ...def.buildUpdate(rest as Omit<U, 'id'>), ...(def.stampUpdatedBy ? { updatedById: ctx.principal.userId } : {}) };

    // Nothing actually changed — `before` already confirmed the row is in scope, and
    // there is no follow-up write, so skip the (possibly empty) updateMany entirely.
    if (Object.keys(data).length === 0) return { id: input.id };

    const res = await def.pick(ctx.tx).updateMany({ where, data });
    if (res.count !== 1) throw new DomainError('Not found', 'not_found');

    const after = await def.pick(ctx.tx).findUniqueOrThrow({ where: { id: input.id } });
    await writeAudit(ctx.tx, {
      actorUserId: ctx.principal.userId,
      action: 'UPDATE',
      entity: def.entity,
      entityId: input.id,
      before,
      after,
      ...subjectFor(after),
    });
    revalidatePath(def.revalidate);
    return { id: input.id };
  });

  const remove = tenantAction(def.resource, 'delete', async (ctx, raw: { id: string }) => {
    const where = { id: raw.id, ...liveFilter(def.softDelete), ...ctx.where };
    const before = await def.pick(ctx.tx).findFirst({ where });
    if (!before) throw new DomainError('Not found', 'not_found');

    const res = def.softDelete
      ? await def.pick(ctx.tx).updateMany({ where, data: { deletedAt: new Date() } })
      : await def.pick(ctx.tx).deleteMany({ where });
    if (res.count !== 1) throw new DomainError('Not found', 'not_found');

    await writeAudit(ctx.tx, {
      actorUserId: ctx.principal.userId,
      action: def.softDelete ? 'SOFT_DELETE' : 'DELETE',
      entity: def.entity,
      entityId: raw.id,
      before,
      ...subjectFor(before),
    });
    revalidatePath(def.revalidate);
    return { id: raw.id };
  });

  return { create, update, remove };
}

/** Generic scoped list for server components. Rows are JSON-normalized (Date -> ISO,
 * Decimal -> string, BigInt -> string) so they pass cleanly to client components. */
export async function listEntity(
  resource: Resource,
  pick: (tx: TxClient) => Delegate,
  opts: { select?: unknown; orderBy?: unknown; softDelete: boolean; action?: Action },
): Promise<Record<string, unknown>[]> {
  const rows = await tenantLoad(resource, opts.action ?? 'read', ({ tx, where }) =>
    pick(tx).findMany({
      where: { ...liveFilter(opts.softDelete), ...where },
      ...(opts.select ? { select: opts.select } : {}),
      ...(opts.orderBy ? { orderBy: opts.orderBy } : {}),
    }),
  );
  return JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
