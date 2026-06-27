import { PrismaClient } from '@prisma/client';

/**
 * Base Prisma client (singleton). This connects as `app_runtime` (NOBYPASSRLS),
 * so RLS binds to every query. Domain code should NOT use this directly for
 * tenant data — it goes through withOrgTx() (src/server/db/tenant.ts) which opens
 * a transaction and pins `app.current_org_id`. Direct use is limited to:
 *   - auth/session lookups on the GLOBAL, RLS-exempt tables (users, accounts...)
 *   - the bootstrap/provisioning path (which sets the GUC itself)
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
