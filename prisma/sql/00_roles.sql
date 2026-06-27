-- ─────────────────────────────────────────────────────────────────────────────
-- 00_roles.sql — run ONCE by a superuser/owner against the target database.
-- Creates the runtime role used by DATABASE_URL. It is NOBYPASSRLS so Row-Level
-- Security actually binds to it (a superuser would silently bypass RLS).
--
-- Production: do NOT hardcode the password — provision via AWS Secrets Manager /
-- RDS IAM auth and rotate. This file is a template for local + bootstrap.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_pw' NOBYPASSRLS;
  ELSE
    ALTER ROLE app_runtime NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;

-- The owner (migration role) creates tables; ensure future objects are usable by
-- the runtime role. Run this as the migration owner after each `migrate deploy`
-- (10_security.sql re-applies table grants idempotently as a safety net).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
