import 'dotenv/config';

// Point the Prisma singleton at the dedicated test database (which must already
// have migrations + 10_security.sql applied, and be reached as `app_runtime` so
// RLS binds). Done before any module imports env/prisma.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}
