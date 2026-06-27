import type { SystemRole } from '@prisma/client';
import { ACTIONS, RESOURCES, type Action, type Resource, type Scope, type GrantConstraints } from './types';

/**
 * THE PERMISSION CATALOG — every (resource, action) the system understands.
 * Seeded into the global `permissions` table. Grants reference these by id.
 */
export interface PermissionDef {
  resource: Resource;
  action: Action;
  key: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => ({
    resource,
    action,
    key: `${resource}:${action}`,
    description: `${action} ${resource}`,
  })),
);

/** A grant in the default matrix (becomes a RolePermission row at seed time). */
export interface GrantSpec {
  resource: Resource;
  action: Action;
  scope: Scope;
  /** Inert until DEPLOYED_PHASE >= phase. Phase-1 matrix only seeds phase 1. */
  phase?: number;
  constraints?: GrantConstraints;
}

const ALL_RESOURCES_EXCEPT_AUDIT: Resource[] = RESOURCES.filter((r) => r !== 'auditLog');

/** Super Admin / IT god-grant: manage everything in-org, read the audit log. */
const ADMIN_GRANTS: GrantSpec[] = [
  ...ALL_RESOURCES_EXCEPT_AUDIT.map<GrantSpec>((resource) => ({
    resource,
    action: 'manage',
    scope: 'organization',
  })),
  { resource: 'auditLog', action: 'read', scope: 'organization' },
];

/**
 * THE PHASE-1 PERMISSION MATRIX, as data. (Per your decision, IT === SUPER_ADMIN.)
 * Only phase-1 grants are listed; forward (P3/P4) grants are intentionally NOT
 * seeded so the gate cannot allow a future capability early.
 */
export const DEFAULT_ROLE_GRANTS: Record<SystemRole, GrantSpec[]> = {
  SUPER_ADMIN: ADMIN_GRANTS,
  IT: ADMIN_GRANTS, // identical blast radius — accepted tradeoff; split later via grant rows.

  LEADERSHIP: [
    { resource: 'organization', action: 'read', scope: 'organization' },
    { resource: 'department', action: 'read', scope: 'organization' },
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
    { resource: 'player', action: 'read', scope: 'organization' },
    { resource: 'manager', action: 'read', scope: 'organization' },
    { resource: 'mediaAsset', action: 'read', scope: 'organization' },
    { resource: 'auditLog', action: 'read', scope: 'organization' },
  ],

  MANAGER: [
    { resource: 'player', action: 'create', scope: 'roster' },
    { resource: 'player', action: 'read', scope: 'roster' },
    { resource: 'player', action: 'update', scope: 'roster' },
    { resource: 'player', action: 'delete', scope: 'roster' },
    { resource: 'roster', action: 'read', scope: 'roster' },
    { resource: 'manager', action: 'read', scope: 'own' },
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'mediaAsset', action: 'manage', scope: 'roster' },
  ],

  PLAYER: [
    { resource: 'player', action: 'read', scope: 'own' },
    {
      resource: 'player',
      action: 'update',
      scope: 'own',
      constraints: { fields: ['firstName', 'lastName', 'phone'] },
    },
    { resource: 'mediaAsset', action: 'read', scope: 'own' },
  ],

  // Marcom / Aviation / Merch: read-only nav shell in P1; real capabilities ship P4.
  MARCOM: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
  ],
  AVIATION: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
  ],
  MERCH: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
  ],
};

/** Modules enabled for a brand-new tenant in Phase 1 (CORE only). */
export const DEFAULT_ENABLED_MODULES = ['CORE'] as const;
