import type { ModuleKey, SystemRole } from '@prisma/client';
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

// Phase 2 grants every role gets: raise/see/comment on requests, see own tasks &
// notifications, and the calendar. (Admin/IT already have manage via ADMIN_GRANTS.)
const COMMON_P2: GrantSpec[] = [
  { resource: 'request', action: 'create', scope: 'organization', phase: 2 },
  { resource: 'request', action: 'read', scope: 'own', phase: 2 },
  { resource: 'request', action: 'update', scope: 'own', phase: 2 },
  { resource: 'task', action: 'read', scope: 'own', phase: 2 },
  { resource: 'task', action: 'update', scope: 'own', phase: 2 },
  { resource: 'notification', action: 'read', scope: 'own', phase: 2 },
  { resource: 'notification', action: 'update', scope: 'own', phase: 2 },
  { resource: 'calendar', action: 'read', scope: 'organization', phase: 2 },
];

// Departments that receive routed requests handle them at department scope.
const DEPT_HANDLER: GrantSpec[] = [
  { resource: 'request', action: 'read', scope: 'department', phase: 2 },
  { resource: 'request', action: 'update', scope: 'department', phase: 2 },
];

/**
 * THE PERMISSION MATRIX, as data. IT === SUPER_ADMIN (your decision). Every grant
 * is phase-tagged; the gate enforces phase ≤ DEPLOYED_PHASE so nothing fires early.
 */
export const DEFAULT_ROLE_GRANTS: Record<SystemRole, GrantSpec[]> = {
  SUPER_ADMIN: ADMIN_GRANTS,
  IT: [...ADMIN_GRANTS, ...DEPT_HANDLER], // also the technical-service request handler.

  LEADERSHIP: [
    // P1 — read across all.
    { resource: 'organization', action: 'read', scope: 'organization' },
    { resource: 'department', action: 'read', scope: 'organization' },
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
    { resource: 'player', action: 'read', scope: 'organization' },
    { resource: 'manager', action: 'read', scope: 'organization' },
    { resource: 'mediaAsset', action: 'read', scope: 'organization' },
    { resource: 'auditLog', action: 'read', scope: 'organization' },
    // P2 — assigns tasks to managers; sees all requests + calendar.
    { resource: 'request', action: 'read', scope: 'organization', phase: 2 },
    { resource: 'request', action: 'create', scope: 'organization', phase: 2 },
    { resource: 'task', action: 'create', scope: 'organization', phase: 2 },
    { resource: 'task', action: 'read', scope: 'organization', phase: 2 },
    { resource: 'task', action: 'update', scope: 'organization', phase: 2 },
    { resource: 'notification', action: 'read', scope: 'own', phase: 2 },
    { resource: 'notification', action: 'update', scope: 'own', phase: 2 },
    { resource: 'calendar', action: 'read', scope: 'organization', phase: 2 },
    // P3 — tracks contracts/performance/etc. (salaries stay admin/manager/own).
    { resource: 'tournament', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'contract', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'attendance', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'performance', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'bootcamp', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'schedule', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'merchProfile', action: 'read', scope: 'organization', phase: 3 },
    { resource: 'jerseyEntitlement', action: 'read', scope: 'organization', phase: 3 },
    // P4
    { resource: 'trip', action: 'read', scope: 'organization', phase: 4 },
    { resource: 'invoice', action: 'read', scope: 'organization', phase: 4 },
  ],

  MANAGER: [
    // P1 — full CRUD on their roster's players + media.
    { resource: 'player', action: 'create', scope: 'roster' },
    { resource: 'player', action: 'read', scope: 'roster' },
    { resource: 'player', action: 'update', scope: 'roster' },
    { resource: 'player', action: 'delete', scope: 'roster' },
    { resource: 'roster', action: 'read', scope: 'roster' },
    { resource: 'manager', action: 'read', scope: 'own' },
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'mediaAsset', action: 'manage', scope: 'roster' },
    // P2
    ...COMMON_P2,
    ...DEPT_HANDLER, // management-routed requests
    { resource: 'task', action: 'create', scope: 'organization', phase: 2 },
    // P3 — uploads everything for their roster.
    { resource: 'tournament', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'contract', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'salary', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'attendance', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'performance', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'schedule', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'merchProfile', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'jerseyEntitlement', action: 'manage', scope: 'roster', phase: 3 },
    { resource: 'bootcamp', action: 'read', scope: 'organization', phase: 3 },
    // P4
    { resource: 'trip', action: 'manage', scope: 'roster', phase: 4 },
    { resource: 'invoice', action: 'read', scope: 'roster', phase: 4 },
    { resource: 'invoice', action: 'update', scope: 'roster', phase: 4 }, // approve/reject submitted invoices
  ],

  PLAYER: [
    // P1 — self-service.
    { resource: 'player', action: 'read', scope: 'own' },
    { resource: 'player', action: 'update', scope: 'own', constraints: { fields: ['firstName', 'lastName', 'phone'] } },
    { resource: 'mediaAsset', action: 'read', scope: 'own' },
    // P2
    ...COMMON_P2,
    // P3/P4 — own performance, invoices, trips, schedule.
    { resource: 'performance', action: 'read', scope: 'own', phase: 3 },
    { resource: 'invoice', action: 'read', scope: 'own', phase: 4 },
    { resource: 'invoice', action: 'create', scope: 'own', phase: 4 }, // upload an invoice for approval
    { resource: 'trip', action: 'read', scope: 'own', phase: 4 },
    { resource: 'schedule', action: 'read', scope: 'own', phase: 4 },
  ],

  MARCOM: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
    ...COMMON_P2,
    ...DEPT_HANDLER, // photography requests
    { resource: 'tournament', action: 'read', scope: 'organization', phase: 3 }, // full tournament calendar
    { resource: 'mediaAsset', action: 'manage', scope: 'organization', phase: 4 }, // media library
  ],

  AVIATION: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
    { resource: 'player', action: 'read', scope: 'organization', phase: 4 }, // booking data (passport/DOB)
    ...COMMON_P2,
    ...DEPT_HANDLER, // travel requests
    { resource: 'trip', action: 'manage', scope: 'organization', phase: 4 },
  ],

  MERCH: [
    { resource: 'gameTitle', action: 'read', scope: 'organization' },
    { resource: 'roster', action: 'read', scope: 'organization' },
    ...COMMON_P2,
    ...DEPT_HANDLER, // merch requests
    { resource: 'merchProfile', action: 'manage', scope: 'organization', phase: 3 },
    { resource: 'jerseyEntitlement', action: 'manage', scope: 'organization', phase: 3 },
  ],

  // Finance: receives manager-approved invoices and pays them.
  FINANCE: [
    ...COMMON_P2,
    { resource: 'player', action: 'read', scope: 'organization', phase: 4 }, // see who an invoice is for
    { resource: 'invoice', action: 'read', scope: 'organization', phase: 4 },
    { resource: 'invoice', action: 'update', scope: 'organization', phase: 4 }, // mark paid
  ],
};

/** Modules a brand-new tenant gets. We ship the full product, so enable everything;
 * a tenant can later disable modules per their plan via OrgModule. */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [
  'CORE',
  'REQUESTS',
  'TASKS',
  'CALENDAR',
  'TOURNAMENTS',
  'CONTRACTS',
  'SALARIES',
  'ATTENDANCE',
  'PERFORMANCE',
  'MERCH',
  'PLAYER_PORTAL',
  'MARCOM',
  'AVIATION',
  'ROSTER_CALCULATOR',
];
