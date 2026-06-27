import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { prisma } from './client';

/**
 * THE canonical RLS session variable. This string appears in exactly two places:
 * here, and prisma/sql/10_security.sql. A CI check (scripts/verify-security.mjs)
 * asserts the policies read this exact name, so the "RLS is the real boundary"
 * claim can't silently break on a typo.
 */
export const ORG_GUC = 'app.current_org_id';

/**
 * Secondary GUC so a user can always read THEIR OWN membership/org rows across
 * tenants (for the org switcher + principal resolution) without seeing anyone
 * else's data. Backed by the membership_self / org_self_read policies in
 * prisma/sql/10_security.sql.
 */
export const USER_GUC = 'app.current_user_id';

export type TxClient = Prisma.TransactionClient;

/** Per-request store. Holds the active org so nested calls don't re-thread it. */
const tenantStore = new AsyncLocalStorage<{ orgId: string }>();

export function getActiveOrgId(): string | null {
  return tenantStore.getStore()?.orgId ?? null;
}

export function requireActiveOrgId(): string {
  const orgId = getActiveOrgId();
  if (!orgId) {
    throw new Error('No active organization in context. Wrap data access in withOrgTx().');
  }
  return orgId;
}

/**
 * Open a transaction pinned to `orgId` via `SET LOCAL app.current_org_id`, so
 * Postgres RLS filters every statement inside `fn` — including nested
 * include/select traversals that the app layer can't see. This is the read AND
 * write path for all tenant data (A4: RLS-everywhere, not a hybrid).
 *
 * `orgId` is a trusted uuid resolved from the session; it is bound as a query
 * parameter (not string-interpolated), so it cannot be used for SQL injection.
 */
export async function withOrgTx<T>(
  orgId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return tenantStore.run({ orgId }, () =>
    prisma.$transaction(async (tx) => {
      // set_config(name, value, is_local=true) scopes the GUC to this transaction.
      await tx.$queryRaw`SELECT set_config(${ORG_GUC}, ${orgId}, true)`;
      return fn(tx);
    }),
  );
}

/**
 * Read-only transaction scoped to a USER (not an org). Sets app.current_user_id
 * so the caller can list their own memberships + the orgs they belong to, across
 * tenants. No org GUC is set, so every other tenant table returns zero rows.
 */
export async function withUserScope<T>(userId: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config(${USER_GUC}, ${userId}, true)`;
    return fn(tx);
  });
}

/**
 * Elevated bootstrap transaction for creating a brand-new org + its first
 * Super Admin atomically. It sets the GUC to `orgId` AFTER the org row is
 * inserted (the org_bootstrap_insert RLS policy permits the initial INSERT).
 * Only called from the provisioning service, never from client-influenced input.
 */
export async function withBootstrapTx<T>(
  fn: (tx: TxClient, setOrg: (orgId: string) => Promise<void>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const setOrg = async (orgId: string) => {
      await tx.$queryRaw`SELECT set_config(${ORG_GUC}, ${orgId}, true)`;
      tenantStore.enterWith({ orgId });
    };
    return fn(tx, setOrg);
  });
}
