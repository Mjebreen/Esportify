import { env } from '../env';
import {
  type Action,
  type AuthDecision,
  type EffectiveGrant,
  type Principal,
  type Resource,
  type Scope,
  type ScopeWhere,
  RESOURCE_MODULE,
  SCOPES,
} from './types';

/** A where fragment that matches no rows — used when a scope can't resolve (e.g. null managerId). */
const NEVER: ScopeWhere = { id: { in: [] as string[] } };

const scopeRank = (s: Scope): number => SCOPES.indexOf(s);

/** A `manage` grant satisfies any concrete action; otherwise actions must match. */
function grantCovers(grant: EffectiveGrant, action: Action): boolean {
  return grant.action === action || grant.action === 'manage';
}

/**
 * Translate a (resource, scope) into a Prisma `where` fragment for the principal.
 * The repo always ALSO pins organizationId + deletedAt, and RLS is the floor —
 * this fragment narrows WITHIN the tenant.
 */
/** Entities that hang off Player — scoped via the related player's roster/owner. */
const PLAYER_OWNED: Resource[] = [
  'contract',
  'salary',
  'attendance',
  'performance',
  'merchProfile',
  'jerseyEntitlement',
  'trip',
  'invoice',
];

function resolveScope(resource: Resource, scope: Scope, p: Principal): ScopeWhere {
  if (scope === 'organization') return {};

  if (scope === 'department') {
    if (!p.departmentIds.length) return NEVER;
    // Requests route to a target department; other dept-scoped models use departmentId.
    return resource === 'request'
      ? { targetDepartmentId: { in: p.departmentIds } }
      : { departmentId: { in: p.departmentIds } };
  }

  if (scope === 'roster') {
    switch (resource) {
      case 'player':
        return p.managerId ? { roster: { managerId: p.managerId } } : NEVER;
      case 'roster':
        return p.managerId ? { managerId: p.managerId } : NEVER;
      case 'mediaAsset':
        return p.managedRosterIds.length ? { rosterId: { in: p.managedRosterIds } } : NEVER;
      case 'tournament':
      case 'schedule':
        return p.managerId ? { roster: { managerId: p.managerId } } : NEVER;
      default:
        if (PLAYER_OWNED.includes(resource)) {
          return p.managerId ? { player: { roster: { managerId: p.managerId } } } : NEVER;
        }
        return NEVER;
    }
  }

  // scope === 'own'
  switch (resource) {
    case 'player':
    case 'manager':
      return { userId: p.userId };
    case 'mediaAsset':
      return p.playerId ? { ownerType: 'PLAYER', ownerId: p.playerId } : { uploadedById: p.userId };
    case 'request':
      return { OR: [{ requesterUserId: p.userId }, { assigneeUserId: p.userId }] };
    case 'task':
      return { OR: [{ assigneeUserId: p.userId }, { creatorUserId: p.userId }] };
    case 'notification':
      return { userId: p.userId };
    case 'schedule':
      return { roster: { players: { some: { userId: p.userId } } } };
    default:
      if (PLAYER_OWNED.includes(resource)) return { player: { userId: p.userId } };
      return NEVER;
  }
}

/**
 * THE GATE. Every loader and mutation calls this server-side. Returns the WHERE
 * the caller MUST apply — you cannot get an `allowed: true` without the predicate
 * that scopes the rows, so "allowed but unfiltered" is structurally impossible.
 */
export function authorize(p: Principal, action: Action, resource: Resource): AuthDecision {
  // 1. Module gate — a disabled module is unreachable even with a grant.
  const moduleKey = RESOURCE_MODULE[resource];
  if (!p.enabledModules.has(moduleKey)) {
    return { allowed: false, reason: `module_disabled:${moduleKey}` };
  }

  // 2. Candidate grants: right resource, action covered, and phase has shipped.
  const candidates = p.grants.filter(
    (g) => g.resource === resource && grantCovers(g, action) && g.phase <= env.DEPLOYED_PHASE,
  );

  // 3. DENY wins (reserved for later phases; none seeded in P1).
  if (candidates.some((g) => g.effect === 'DENY')) {
    return { allowed: false, reason: 'explicit_deny' };
  }

  const allows = candidates.filter((g) => g.effect === 'ALLOW');
  if (allows.length === 0) {
    return { allowed: false, reason: 'no_grant' };
  }

  // 4. Broadest scope wins (multi-role union).
  const winner = allows.reduce((best, g) => (scopeRank(g.scope) > scopeRank(best.scope) ? g : best));

  return {
    allowed: true,
    scope: winner.scope,
    where: resolveScope(resource, winner.scope, p),
    constraints: winner.constraints,
  };
}

/** Throwing variant for call sites that just need a pass/fail gate. */
export function assertAuthorized(p: Principal, action: Action, resource: Resource): Extract<AuthDecision, { allowed: true }> {
  const decision = authorize(p, action, resource);
  if (!decision.allowed) {
    throw new AuthorizationError(action, resource, decision.reason);
  }
  return decision;
}

/**
 * Anti-amplification: does the principal itself hold (resource, action) at >= scope?
 * Used when editing the permission matrix or assigning roles — you can never grant
 * a capability you don't possess, closing the "whoever writes RolePermission owns
 * the kingdom" escalation path.
 */
export function holdsGrant(p: Principal, resource: Resource, action: Action, scope: Scope): boolean {
  return p.grants.some(
    (g) =>
      g.effect === 'ALLOW' &&
      g.resource === resource &&
      grantCovers(g, action) &&
      scopeRank(g.scope) >= scopeRank(scope) &&
      g.phase <= env.DEPLOYED_PHASE,
  );
}

export class AuthorizationError extends Error {
  constructor(
    public readonly action: Action,
    public readonly resource: Resource,
    public readonly reason: string,
  ) {
    super(`Forbidden: ${action}:${resource} (${reason})`);
    this.name = 'AuthorizationError';
  }
}
