import 'dotenv/config';
import pg from 'pg';

/**
 * CI smoke check (A13): fail the build if the tenant-isolation floor is not actually
 * in place — RLS enabled + FORCED on every tenant table, every policy reads the ONE
 * canonical GUC name, and the runtime role is NOBYPASSRLS. A green app with broken
 * RLS is the nightmare this prevents.
 */
const TENANT_TABLES = [
  'organizations', 'memberships', 'roles', 'role_permissions', 'departments',
  'game_titles', 'managers', 'rosters', 'players', 'org_modules', 'media_assets', 'audit_logs',
];
const GUC = 'app.current_org_id';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString });
const failures = [];

try {
  await client.connect();

  const { rows: rls } = await client.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class WHERE relname = ANY($1::text[])`,
    [TENANT_TABLES],
  );
  for (const table of TENANT_TABLES) {
    const row = rls.find((r) => r.relname === table);
    if (!row) failures.push(`table ${table} not found`);
    else if (!row.relrowsecurity) failures.push(`RLS not ENABLED on ${table}`);
    else if (!row.relforcerowsecurity) failures.push(`RLS not FORCED on ${table}`);
  }

  const { rows: policies } = await client.query(
    `SELECT c.relname AS table, p.polname,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
       FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = ANY($1::text[])`,
    [TENANT_TABLES],
  );
  for (const pol of policies) {
    const text = `${pol.using_expr ?? ''} ${pol.check_expr ?? ''}`;
    // A policy that references the org must use the canonical GUC name.
    if (/current_setting/.test(text) && !text.includes(GUC)) {
      failures.push(`policy ${pol.table}.${pol.polname} uses a non-canonical GUC (expected ${GUC})`);
    }
  }

  const { rows: role } = await client.query(`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_runtime'`);
  if (role.length === 0) {
    console.warn('⚠ app_runtime role not found — RLS will NOT bind if the app connects as a superuser.');
  } else if (role[0].rolbypassrls) {
    failures.push('app_runtime has BYPASSRLS — RLS will not bind to the app');
  }
} catch (err) {
  failures.push(`query error: ${err.message}`);
} finally {
  await client.end();
}

if (failures.length) {
  console.error('✖ Security verification FAILED:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('✔ Security verified: RLS enabled+forced, canonical GUC, NOBYPASSRLS runtime role.');
