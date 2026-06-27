import type { ModuleKey, SystemRole } from '@prisma/client';

/** The verbs. `manage` implies create+read+update+delete for that resource. */
export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
export type Action = (typeof ACTIONS)[number];

/** Row-visibility tiers, narrowest → broadest. */
export const SCOPES = ['own', 'roster', 'department', 'organization'] as const;
export type Scope = (typeof SCOPES)[number];

/** Phase-1 resources. The matrix is forward-stable; later phases add resources. */
export const RESOURCES = [
  'organization',
  'membership',
  'role',
  'rolePermission',
  'orgModule',
  'department',
  'gameTitle',
  'roster',
  'player',
  'manager',
  'mediaAsset',
  'auditLog',
] as const;
export type Resource = (typeof RESOURCES)[number];

/** Which feature module gates a resource. CORE is always on and cannot be toggled. */
export const RESOURCE_MODULE: Record<Resource, ModuleKey> = {
  organization: 'CORE',
  membership: 'CORE',
  role: 'CORE',
  rolePermission: 'CORE',
  orgModule: 'CORE',
  department: 'CORE',
  gameTitle: 'CORE',
  roster: 'CORE',
  player: 'CORE',
  manager: 'CORE',
  mediaAsset: 'CORE',
  auditLog: 'CORE',
};

/** A single grant row, resolved from the DB for the principal's active roles. */
export interface EffectiveGrant {
  resource: Resource;
  action: Action;
  scope: Scope;
  effect: 'ALLOW' | 'DENY';
  phase: number;
  constraints: GrantConstraints | null;
}

export interface GrantConstraints {
  /** Allowlist of self-editable columns for update:own (e.g. Player portal). */
  fields?: string[];
}

/**
 * The trusted, server-derived identity for a request. Built FRESH from the DB on
 * every request by getPrincipal() — never trusted from the JWT (A11). Carries the
 * effective grant set (union of all ACTIVE memberships' roles in the active org).
 */
export interface Principal {
  userId: string;
  organizationId: string;
  isPlatformStaff: boolean;
  /** SystemRole hints for the active org (UI/labels only — authz uses `grants`). */
  roleHints: SystemRole[];
  grants: EffectiveGrant[];
  enabledModules: Set<ModuleKey>;
  /** Scope-resolution inputs, derived for the ACTIVE org specifically. */
  managerId: string | null;
  playerId: string | null;
  managedRosterIds: string[];
  departmentIds: string[];
}

/** A Prisma `where` fragment. Repos spread this into their typed where at the boundary. */
export type ScopeWhere = Record<string, unknown>;

export type AuthDecision =
  | { allowed: false; reason: string }
  | {
      allowed: true;
      scope: Scope;
      where: ScopeWhere;
      constraints: GrantConstraints | null;
    };
