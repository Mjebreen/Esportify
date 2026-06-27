# Esportify — Esports Org Operations Platform

Multi-tenant SaaS for professional esports organizations — _"Asana × Odoo for esports teams."_ Discrete department modules over one organizational database, plus a cross-department request/task engine.

**This repository is Phase 1 (the foundation).** Department features (requests, tasks, tournaments, contracts, salaries, player portal, etc.) arrive in Phases 2–4 and are intentionally not built yet.

---

## What Phase 1 ships

- **Multi-tenancy** with three-layer isolation: request context → query-layer org scoping → **Postgres RLS** floor (`FORCE ROW LEVEL SECURITY`, `NOBYPASSRLS` runtime role).
- **Auth** (NextAuth/Auth.js, Credentials) where the JWT carries only `userId` and the authorization principal is re-derived from the DB **every request** (instant revocation).
- **Data-driven RBAC** — a `Permission × Role × RolePermission` matrix resolved by one server-side `authorize()` gate. No `if (role === …)` anywhere.
- **Org/user provisioning** — atomic bootstrap of an org + roles + grants + first Super Admin.
- **Players + Managers CRUD** (the gravity well) with scope-aware reads and audited writes.
- **Append-only audit log** with write-time redaction; **S3 media plumbing** (private bucket, authorize-then-sign, visibility-enforced).
- **i18n EN/AR + RTL** from day one (next-intl, logical CSS, `<html dir>`).
- **Per-tenant module toggles** gating navigation and the `authorize()` gate.
- A **cross-tenant isolation test** proving org A can't touch org B's data, and a **seed** with one demo org + one user per role.

Locked decisions: **NextAuth** · AWS **me-central-1** (KSA/PDPL residency) · Managers see **only their own roster** · **IT == Super Admin** (accepted blast-radius tradeoff, reversible via grant rows).

See [`docs/PHASE1.md`](docs/PHASE1.md) for the permission matrix, architecture, and acceptance checklist.

---

## Prerequisites

- **Node 20+** and npm
- **PostgreSQL 14+** (local Docker or RDS). Two DB roles by design (see below).

---

## Setup

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
#   - set AUTH_SECRET   (npx auth secret  OR  openssl rand -base64 32)
#   - set DATABASE_URL  -> app_runtime role (NOBYPASSRLS) so RLS binds
#   - set DIRECT_URL    -> migration owner role
npx auth secret   # writes AUTH_SECRET into .env

# 3. Create the runtime role + grants (run ONCE, as a superuser/owner)
psql "$DIRECT_URL" -f prisma/sql/00_roles.sql

# 4. Create tables (generates the first migration from prisma/schema.prisma)
npx prisma migrate dev --name init

# 5. Apply the security floor: RLS, composite FK guards, partial indexes, audit immutability
npm run db:security

# 6. Verify the floor is actually in place (CI-style smoke check)
npm run db:verify

# 7. Seed one demo org + one user per role + demo roster/players
npm run seed

# 8. Run
npm run dev   # http://localhost:3000
```

> **Two-role model.** `DATABASE_URL` must point at `app_runtime` (a `NOBYPASSRLS`, non-superuser role) or **RLS will not bind** — a superuser silently bypasses Row-Level Security. `DIRECT_URL` is the migration owner. For a quick local spike you may point both at one superuser, but then you are not testing the real isolation posture.

### Demo accounts

All share the password **`Passw0rd!`** (org **Falcons Esports**, slug `falcons`):

| Email | Role | Sees |
|---|---|---|
| `superadmin@falcons.gg` | Super Admin | everything in-org |
| `it@falcons.gg` | IT | everything in-org (== Super Admin) |
| `leadership@falcons.gg` | Leadership | read-across-all |
| `manager@falcons.gg` | Manager | only their roster's players |
| `player@falcons.gg` | Player | only their own profile |
| `marcom@falcons.gg` | Marcom | read-only nav shell (features = P4) |
| `aviation@falcons.gg` | Aviation | read-only nav shell (features = P4) |
| `merch@falcons.gg` | Merch | read-only nav shell (features = P4) |

Sign in as the **Manager** then the **Leadership** account to see the same `/players` page return different rows — that's the RBAC scope resolver + RLS at work.

---

## Testing

```bash
npm run test            # unit: gate, scope resolution, redaction, media visibility (no DB)
npm run test:isolation  # cross-tenant isolation (needs a secured test DB)
npm run typecheck       # end-to-end types, no `any` at boundaries
```

The isolation suite **skips automatically** if no test DB is reachable. To run it for real:

```bash
createdb esportify_test
# point a temp env at it, then:
DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://app_runtime:app_pw@localhost:5432/esportify_test npm run db:security
npm run test:isolation   # connects as app_runtime so RLS actually binds
```

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | `prisma migrate dev` (schema → migration) |
| `npm run db:deploy` | `migrate deploy` **+ apply security SQL** |
| `npm run db:security` | Apply `prisma/sql/10_security.sql` (RLS, FK guards, indexes, audit immutability) |
| `npm run db:verify` | Assert RLS enabled+forced, canonical GUC, `NOBYPASSRLS` role |
| `npm run db:setup` | `migrate deploy` + security + seed |
| `npm run seed` | Demo org + one user per role |
| `npm run typecheck` / `test` | Types / tests |

---

## Architecture (one screen)

```
Request ─▶ NextAuth (JWT: userId only)
        ─▶ getPrincipal(userId)         ← re-reads roles/membership/org status from DB EVERY request
        ─▶ authorize(action, resource)  ← module gate · phase gate · grant union · scope→WHERE
        ─▶ withOrgTx(orgId)             ← SET LOCAL app.current_org_id  (RLS floor binds here)
        ─▶ handler(tx, where)           ← repo merges scope WHERE; writeAudit() in the same tx
```

- **Tenant key:** every tenant row carries `organizationId`; composite `(organizationId, id)` FK guards make cross-tenant references structurally impossible.
- **Source of truth for the matrix:** `src/server/authz/catalog.ts` (seeded into `permissions` + `role_permissions`).
- **Where the security floor lives:** `prisma/sql/10_security.sql` (committed, applied with every deploy).

### Deployment shape (target)

Region **me-central-1**. Next.js (OpenNext/SST or container) · **RDS Postgres** (app connects as `app_runtime`) · **private S3** media bucket (presigned URLs only) · secrets in AWS Secrets Manager. The `app_runtime` password and AWS keys are never committed.

---

## Project layout

```
prisma/
  schema.prisma            # canonical schema (UUID PKs, citext, soft-delete, audit, media)
  sql/00_roles.sql         # app_runtime role (run once)
  sql/10_security.sql      # RLS + composite FK guards + partial indexes + audit immutability
  seed.ts                  # demo org + one user per role
src/
  server/
    env.ts                 # zod-validated env
    db/{client,tenant}.ts  # base client + org-bound RLS transaction (ORG_GUC)
    auth/                   # NextAuth config, principal resolver, session bridge
    authz/                  # types, catalog (the matrix), gate (authorize/holdsGrant)
    audit/                  # append-only writer + write-time redaction
    storage/                # S3 presign with visibility enforcement
    provisioning/           # org bootstrap + addMember
    action.ts               # tenantAction / tenantLoad wrappers (the only path to data)
    nav.ts                  # role-aware navigation
  modules/players|managers/ # schema · server queries · audited server actions
  app/                      # (auth) login · (app) shell + dashboard + players + managers
  components/               # Sidebar, Topbar, LocaleSwitcher, SignOutButton
  i18n/ + messages/         # next-intl (en, ar)
tests/                      # unit.test.ts (no DB) · isolation.test.ts (DB)
scripts/                    # apply-security.mjs · verify-security.mjs
```
