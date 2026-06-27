import type { ModuleKey } from '@prisma/client';
import { withOrgTx, withUserScope } from '../db/tenant';
import type { EffectiveGrant, GrantConstraints, Principal } from '../authz/types';
import type { Action, Resource, Scope } from '../authz/types';

interface ActiveMembership {
  organizationId: string;
  roleId: string;
  departmentId: string | null;
  isPrimary: boolean;
}

/** List the user's ACTIVE memberships across all orgs (their own data, RLS-safe). */
async function listActiveMemberships(userId: string): Promise<ActiveMembership[]> {
  return withUserScope(userId, (tx) =>
    tx.membership.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      select: { organizationId: true, roleId: true, departmentId: true, isPrimary: true },
    }),
  );
}

function pickActiveOrg(memberships: ActiveMembership[], requestedOrgId?: string | null): string | null {
  if (requestedOrgId && memberships.some((m) => m.organizationId === requestedOrgId)) {
    return requestedOrgId;
  }
  const primary = memberships.find((m) => m.isPrimary);
  return primary?.organizationId ?? memberships[0]?.organizationId ?? null;
}

function parseConstraints(value: unknown): GrantConstraints | null {
  if (value && typeof value === 'object' && 'fields' in value) {
    const fields = (value as { fields?: unknown }).fields;
    if (Array.isArray(fields) && fields.every((f) => typeof f === 'string')) {
      return { fields: fields as string[] };
    }
  }
  return null;
}

/**
 * Resolve the trusted Principal FRESH from the DB for `userId` in its active org.
 * The session token only supplies userId (+ an org hint); roles, grants, org/
 * membership status, and scope inputs are all re-read here every request, so a
 * removed/suspended/demoted user loses access immediately (A11).
 *
 * Returns null if the user has no ACTIVE membership in any ACTIVE org.
 */
export async function getPrincipal(userId: string, requestedOrgId?: string | null): Promise<Principal | null> {
  const memberships = await listActiveMemberships(userId);
  if (memberships.length === 0) return null;

  const activeOrgId = pickActiveOrg(memberships, requestedOrgId);
  if (!activeOrgId) return null;

  const orgMemberships = memberships.filter((m) => m.organizationId === activeOrgId);
  const roleIds = orgMemberships.map((m) => m.roleId);

  return withOrgTx(activeOrgId, async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: activeOrgId } });
    if (!org || org.status !== 'ACTIVE' || org.deletedAt) return null;

    const [roles, grantRows, modules, manager, player] = await Promise.all([
      tx.role.findMany({ where: { id: { in: roleIds } }, select: { systemRole: true } }),
      tx.rolePermission.findMany({
        where: { roleId: { in: roleIds } },
        select: {
          scope: true,
          effect: true,
          phase: true,
          constraints: true,
          permission: { select: { resource: true, action: true } },
        },
      }),
      tx.orgModule.findMany({ where: { enabled: true }, select: { module: true } }),
      // organizationId is explicit (belt) on top of RLS (braces) — intent is visible.
      tx.manager.findFirst({ where: { userId, organizationId: activeOrgId, deletedAt: null }, select: { id: true } }),
      tx.player.findFirst({ where: { userId, organizationId: activeOrgId, deletedAt: null }, select: { id: true } }),
    ]);

    const managedRosterIds = manager
      ? (
          await tx.roster.findMany({
            where: { managerId: manager.id, deletedAt: null },
            select: { id: true },
          })
        ).map((r) => r.id)
      : [];

    const grants: EffectiveGrant[] = grantRows.map((g) => ({
      resource: g.permission.resource as Resource,
      action: g.permission.action as Action,
      scope: g.scope as Scope,
      effect: g.effect,
      phase: g.phase,
      constraints: parseConstraints(g.constraints),
    }));

    return {
      userId,
      organizationId: activeOrgId,
      isPlatformStaff: false,
      roleHints: roles.map((r) => r.systemRole).filter((s): s is NonNullable<typeof s> => s !== null),
      grants,
      enabledModules: new Set<ModuleKey>(modules.map((m) => m.module)),
      managerId: manager?.id ?? null,
      playerId: player?.id ?? null,
      managedRosterIds,
      departmentIds: orgMemberships
        .map((m) => m.departmentId)
        .filter((d): d is string => d !== null),
    } satisfies Principal;
  });
}

/** Orgs the user belongs to, for the org switcher. Reads only the user's own rows. */
export async function listUserOrganizations(
  userId: string,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  return withUserScope(userId, async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      select: { organizationId: true },
    });
    const orgIds = [...new Set(memberships.map((m) => m.organizationId))];
    if (orgIds.length === 0) return [];
    return tx.organization.findMany({
      where: { id: { in: orgIds }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  });
}
