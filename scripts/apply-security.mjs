import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Applies prisma/sql/10_security.sql (RLS, composite FK guards, partial indexes,
 * audit immutability) right after `prisma migrate deploy`, as the migration owner.
 * Idempotent — safe to re-run. This is how the tenant-isolation floor ships with
 * every deploy instead of as a manual afterthought.
 */
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✖ DIRECT_URL / DATABASE_URL not set');
  process.exit(1);
}

const sqlPath = fileURLToPath(new URL('../prisma/sql/10_security.sql', import.meta.url));
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  await client.query(sql);
  console.log('✔ Security SQL applied (RLS, composite FK guards, partial indexes, audit immutability).');
} catch (err) {
  console.error('✖ Failed to apply security SQL:', err.message);
  if (err.detail) console.error('   detail:', err.detail);
  if (err.hint) console.error('   hint:', err.hint);
  if (err.where) console.error('   where:', err.where);
  process.exitCode = 1;
} finally {
  await client.end();
}
