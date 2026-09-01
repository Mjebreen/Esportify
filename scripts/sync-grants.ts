import 'dotenv/config';
import pg from 'pg';
import { DEFAULT_ROLE_GRANTS, PERMISSION_CATALOG } from '../src/server/authz/catalog';
import type { SystemRole } from '@prisma/client';

/**
 * Ships permission-catalog changes to EXISTING orgs, additively and idempotently:
 *  1. upserts the global `permissions` catalog (resource × action),
 *  2. for every org × system role, inserts any RolePermission rows present in
 *     DEFAULT_ROLE_GRANTS but missing in the DB.
 * Never deletes or modifies existing grants (tenant customizations survive).
 * Runs as the migration owner (DIRECT_URL) — RLS does not apply to catalog sync.
 * Usage: npx tsx scripts/sync-grants.ts
 */
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✖ DIRECT_URL / DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  // 1. Global permission catalog.
  let permsAdded = 0;
  for (const p of PERMISSION_CATALOG) {
    const res = await client.query(
      `INSERT INTO permissions (id, key, resource, action, description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (key) DO NOTHING`,
      [p.key, p.resource, p.action, p.description],
    );
    permsAdded += res.rowCount ?? 0;
  }

  // 2. Per-org role grants (insert missing only).
  const { rows: roles } = await client.query(
    `SELECT id, "organizationId", "systemRole" FROM roles WHERE "systemRole" IS NOT NULL AND "deletedAt" IS NULL`,
  );
  const { rows: perms } = await client.query(`SELECT id, key FROM permissions`);
  const permIdByKey = new Map<string, string>(perms.map((p) => [p.key, p.id]));

  let grantsAdded = 0;
  for (const role of roles) {
    const specs = DEFAULT_ROLE_GRANTS[role.systemRole as SystemRole] ?? [];
    for (const g of specs) {
      const permissionId = permIdByKey.get(`${g.resource}:${g.action}`);
      if (!permissionId) throw new Error(`Permission missing from catalog: ${g.resource}:${g.action}`);
      const res = await client.query(
        `INSERT INTO role_permissions (id, "organizationId", "roleId", "permissionId", scope, effect, phase, constraints, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ALLOW', $5, $6, now())
         ON CONFLICT ("organizationId", "roleId", "permissionId", scope) DO NOTHING`,
        [role.organizationId, role.id, permissionId, g.scope, g.phase ?? 1, g.constraints ? JSON.stringify(g.constraints) : null],
      );
      grantsAdded += res.rowCount ?? 0;
    }
  }

  console.log(`✔ Grant sync complete: +${permsAdded} catalog permissions, +${grantsAdded} role grants across ${roles.length} org-roles.`);
}

main()
  .catch((err) => {
    console.error('✖ sync-grants failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
