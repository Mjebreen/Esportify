-- ─────────────────────────────────────────────────────────────────────────────
-- 10_security.sql — the tenant-isolation floor. Idempotent. Applied right after
-- `prisma migrate deploy` by `npm run db:security` (see scripts/apply-security.mjs),
-- so the security boundary ships with every migration, never as a manual afterthought.
--
-- Contents:
--   A. RLS: ENABLE + FORCE + tenant_isolation policy on every org-scoped table.
--   B. Composite (organizationId, id) FK guards — cross-tenant FK edges become
--      structurally impossible in Postgres, not merely filtered.
--   C. Partial unique indexes (WHERE deletedAt IS NULL) so soft-deleted rows
--      don't permanently reserve a gamertag / slug / email.
--   D. Authorship FKs (createdById/updatedById) -> users(id) ON DELETE SET NULL.
--   E. Audit immutability: REVOKE UPDATE/DELETE on audit_logs from app_runtime.
--   F. Table grants for app_runtime (safety net).
--
-- The canonical RLS variable is `app.current_org_id` (uuid). It is referenced in
-- exactly one place at the app layer (src/server/db/tenant.ts -> ORG_GUC) and here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- Null-safe GUC readers. A custom GUC, once SET in a connection's lifetime, reverts
-- to '' (empty) — not NULL — when its LOCAL value unwinds. `''::uuid` would throw, so
-- NULLIF(...,'') maps both "unset" and "empty" to NULL → the policy fails CLOSED.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $fn$;
CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $fn$;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'memberships','roles','role_permissions','departments','game_titles',
    'managers','rosters','players','org_modules','media_assets','audit_logs',
    -- Phase 2
    'requests','tasks','comments','notifications',
    -- Phase 3
    'tournaments','contracts','contract_clauses','salaries','attendance',
    'performance_records','bootcamps','schedules','merch_size_profiles','jersey_entitlements',
    -- Phase 4
    'trips','flight_options','invoices',
    -- Approval engine
    'workflow_items',
    -- Results & comms
    'match_results','announcements'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("organizationId" = app_current_org()) '
      'WITH CHECK ("organizationId" = app_current_org());',
      t
    );
  END LOOP;
END
$$;

-- A user may always read their OWN membership rows across tenants (org switcher +
-- principal resolution), guarded by app.current_user_id. This is the user's own
-- data — not a cross-tenant leak of anyone else's. ORs with tenant_isolation.
DROP POLICY IF EXISTS membership_self ON memberships;
CREATE POLICY membership_self ON memberships FOR SELECT
  USING ("userId" = app_current_user());

-- Root tenant table (keyed by id, not organizationId). SELECT is pinned to the
-- active org OR to orgs the current user belongs to (so the switcher can show
-- their names). UPDATE/DELETE pinned to active org; INSERT allowed for the
-- app-gated bootstrap, after which SET LOCAL app.current_org_id pins child writes.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_self_read ON organizations;
DROP POLICY IF EXISTS org_self_write ON organizations;
DROP POLICY IF EXISTS org_bootstrap_insert ON organizations;
CREATE POLICY org_self_read ON organizations FOR SELECT
  USING (
    id = app_current_org()
    OR id IN (
      SELECT m."organizationId" FROM memberships m
      WHERE m."userId" = app_current_user()
        AND m."deletedAt" IS NULL
    )
  );
CREATE POLICY org_self_write ON organizations FOR UPDATE
  USING (id = app_current_org())
  WITH CHECK (id = app_current_org());
CREATE POLICY org_bootstrap_insert ON organizations FOR INSERT WITH CHECK (true);

-- ── B. COMPOSITE CROSS-TENANT FK GUARDS (the Player gravity-well) ─────────────
-- Each references a target's @@unique([organizationId, id]). A child row in org A
-- can never bind to a parent in org B because organizationId must match on both sides.
ALTER TABLE rosters DROP CONSTRAINT IF EXISTS rosters_gametitle_same_org;
ALTER TABLE rosters ADD CONSTRAINT rosters_gametitle_same_org
  FOREIGN KEY ("organizationId", "gameTitleId") REFERENCES game_titles("organizationId", "id");

ALTER TABLE rosters DROP CONSTRAINT IF EXISTS rosters_manager_same_org;
ALTER TABLE rosters ADD CONSTRAINT rosters_manager_same_org
  FOREIGN KEY ("organizationId", "managerId") REFERENCES managers("organizationId", "id");

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_roster_same_org;
ALTER TABLE players ADD CONSTRAINT players_roster_same_org
  FOREIGN KEY ("organizationId", "rosterId") REFERENCES rosters("organizationId", "id");

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_same_org;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_same_org
  FOREIGN KEY ("organizationId", "roleId") REFERENCES roles("organizationId", "id");

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_dept_same_org;
ALTER TABLE memberships ADD CONSTRAINT memberships_dept_same_org
  FOREIGN KEY ("organizationId", "departmentId") REFERENCES departments("organizationId", "id");

ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS rp_role_same_org;
ALTER TABLE role_permissions ADD CONSTRAINT rp_role_same_org
  FOREIGN KEY ("organizationId", "roleId") REFERENCES roles("organizationId", "id");

-- Phase 2–4 composite guards (idempotent). Every tenant→tenant reference is pinned
-- to the same org so a cross-tenant edge is structurally impossible.
DO $$
DECLARE
  g text[][] := ARRAY[
    ARRAY['requests','req_dept_same_org','organizationId,targetDepartmentId','departments','organizationId,id'],
    ARRAY['tasks','task_req_same_org','organizationId,relatedRequestId','requests','organizationId,id'],
    ARRAY['comments','comment_req_same_org','organizationId,requestId','requests','organizationId,id'],
    ARRAY['comments','comment_task_same_org','organizationId,taskId','tasks','organizationId,id'],
    ARRAY['tournaments','tourn_gt_same_org','organizationId,gameTitleId','game_titles','organizationId,id'],
    ARRAY['tournaments','tourn_roster_same_org','organizationId,rosterId','rosters','organizationId,id'],
    ARRAY['contracts','contract_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['contract_clauses','clause_contract_same_org','organizationId,contractId','contracts','organizationId,id'],
    ARRAY['salaries','salary_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['attendance','att_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['attendance','att_schedule_same_org','organizationId,scheduleId','schedules','organizationId,id'],
    ARRAY['performance_records','perf_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['schedules','sched_roster_same_org','organizationId,rosterId','rosters','organizationId,id'],
    ARRAY['merch_size_profiles','merch_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['jersey_entitlements','jersey_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['trips','trip_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['trips','trip_roster_same_org','organizationId,rosterId','rosters','organizationId,id'],
    ARRAY['flight_options','flight_trip_same_org','organizationId,tripId','trips','organizationId,id'],
    ARRAY['invoices','invoice_player_same_org','organizationId,playerId','players','organizationId,id'],
    ARRAY['workflow_items','wf_subject_player_same_org','organizationId,subjectPlayerId','players','organizationId,id'],
    ARRAY['workflow_items','wf_subject_roster_same_org','organizationId,subjectRosterId','rosters','organizationId,id'],
    ARRAY['workflow_items','wf_target_dept_same_org','organizationId,targetDepartmentId','departments','organizationId,id'],
    ARRAY['match_results','mr_roster_same_org','organizationId,rosterId','rosters','organizationId,id']
  ];
  i int;
  cols text;
  refcols text;
BEGIN
  FOR i IN 1 .. array_length(g, 1) LOOP
    cols := '"' || replace(g[i][3], ',', '","') || '"';
    refcols := '"' || replace(g[i][5], ',', '","') || '"';
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I;', g[i][1], g[i][2]);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I(%s);',
      g[i][1], g[i][2], cols, g[i][4], refcols);
  END LOOP;
END
$$;

-- ── C. PARTIAL UNIQUE INDEXES (soft-delete friendly) ─────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS players_org_ign_live
  ON players ("organizationId", "inGameName") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS game_titles_org_slug_live
  ON game_titles ("organizationId", "slug") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_org_slug_live
  ON roles ("organizationId", "slug") WHERE "deletedAt" IS NULL;
-- Exactly one primary org per user among live memberships.
CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_primary_live
  ON memberships ("userId") WHERE "isPrimary" AND "deletedAt" IS NULL;
-- Hot list path: live players by org/status/roster.
CREATE INDEX IF NOT EXISTS players_live_list
  ON players ("organizationId", "status", "rosterId") WHERE "deletedAt" IS NULL;

-- ── D. AUTHORSHIP FKs (createdById / updatedById -> users) ────────────────────
DO $$
DECLARE
  r record;
  authorship_cols text[][] := ARRAY[
    ARRAY['players','createdById'], ARRAY['players','updatedById'],
    ARRAY['managers','createdById'], ARRAY['managers','updatedById'],
    ARRAY['rosters','createdById'],
    ARRAY['memberships','createdById'],
    ARRAY['org_modules','updatedById'],
    ARRAY['invoices','createdById'],
    ARRAY['invoices','approvedById']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(authorship_cols, 1) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I;',
      authorship_cols[i][1], authorship_cols[i][1] || '_' || authorship_cols[i][2] || '_fk');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL;',
      authorship_cols[i][1], authorship_cols[i][1] || '_' || authorship_cols[i][2] || '_fk', authorship_cols[i][2]);
  END LOOP;
END
$$;

-- ── E. AUDIT IMMUTABILITY + F. RUNTIME GRANTS ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    -- Safety-net grants (idempotent).
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime';
    -- Append-only audit log: app_runtime may INSERT and SELECT, never UPDATE/DELETE.
    EXECUTE 'REVOKE UPDATE, DELETE ON audit_logs FROM app_runtime';
  END IF;
END
$$;
