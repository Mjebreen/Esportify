# Phase 1 — Foundation: design & deliverables

This document is the Phase 1 contract: scope, the permission matrix, the enforcement model, and how each adversarial-review finding was resolved. Phase 2 is **not** started — review this first.

---

## 1. Scope

**In:** multi-tenant architecture, auth + session, org/user provisioning, RBAC + permission matrix, Player + Manager core entities with CRUD, base layout/navigation, audit-log + media plumbing, i18n/RTL, per-tenant module toggles, isolation test, seed, run instructions.

**Out (scaffolded only):** Requests/Tasks/Notifications/Calendar (P2); Tournaments/Contracts/Salaries/Attendance/Performance/Merch (P3); Player Portal/Marcom/Aviation/Esports overview/Roster Calculator (P4).

---

## 2. Locked decisions (reconciliation)

The four parallel design drafts contradicted each other; these resolve them into one source of truth.

| # | Decision |
|---|----------|
| A1 | **UUID** PKs (`gen_random_uuid`), `citext` for email/slug |
| A2 | **Data-driven RBAC only** (`Permission × Role × RolePermission`); no hardcoded role map |
| A3 | **One** RLS variable `app.current_org_id` (shared constant + CI check) |
| A4 | **RLS-everywhere reads** — all reads run inside the org-bound transaction |
| A5 | **Composite `(organizationId, id)` FK guards** on the Player gravity-well |
| A6 | **Per-org** profile uniqueness; User→Player/Manager is one-to-many |
| A7 | **Partial unique indexes** `WHERE deleted_at IS NULL` for soft-deletable natural keys |
| A8 | Tenant-scoped set includes `Role/Department/GameTitle/RolePermission/OrgModule/Membership`; only `User`+`Permission` are global |
| A9 | Audit **redaction at write-time** (per-entity + global denylist) |
| A10 | Manager scope = **roster as single source of truth** (`roster.managerId`) |
| A11 | Re-derive principal **fresh from DB every request**; org-switch re-validated, never trusted from token |
| A12 | `Role`/`RolePermission`/`Membership` are gated resources with **anti-amplification** |
| A13 | RLS/FK-guards/audit-immutability are **committed SQL** applied every deploy + a CI smoke check |

Business forks (your answers): **NextAuth** · **me-central-1** · Manager = **strict roster** · **IT == Super Admin**.

---

## 3. Permission matrix (Phase 1)

Model: every grant is `(resource, action, scope)` stored as data. `action ∈ {create, read, update, delete, manage}`; `scope ∈ {own, roster, department, organization}`. `manage` ⊇ CRUD. Source of truth: [`src/server/authz/catalog.ts`](../src/server/authz/catalog.ts).

| Resource | Super Admin / IT | Leadership | Manager | Player | Marcom/Aviation/Merch |
|---|---|---|---|---|---|
| Organization | manage:org | read:org | — | — | — |
| Membership (provision/assign) | manage:org | — | — | — | — |
| Role | manage:org | — | — | — | — |
| RolePermission (the matrix) | manage:org¹ | — | — | — | — |
| OrgModule | manage:org | read:org | — | — | — |
| Department | manage:org | read:org | — | — | — |
| GameTitle | manage:org | read:org | read:org | — | read:org |
| Roster | manage:org | read:org | read:roster | — | read:org |
| **Player** | manage:org | read:org | C/R/U/D:roster | read+update:own² | — |
| **Manager** | manage:org | read:org | read:own | — | — |
| MediaAsset | manage:org | read:org³ | manage:roster | read:own | — |
| AuditLog | read:org | read:org | — | — | — |

¹ Anti-amplification: cannot grant a permission you don't hold; writes emit `PERMISSION_GRANT/REVOKE` audit.
² Player `update:own` restricted to an allowlist (`firstName, lastName, phone`) via grant `constraints`.
³ Visibility still applies — a `RESTRICTED` asset is denied even with `read:org`.

Forward (P3/P4) grants are **not seeded** in Phase 1; the gate also enforces the `phase` column, so a future grant can't fire early even if present.

---

## 4. Enforcement

`authorize(principal, action, resource) → { allowed, scope, where }`, called by every `tenantAction` (mutation) and `tenantLoad` (read):

1. **Module gate** — resource's module enabled for the tenant, else deny (404).
2. **Phase gate** — `grant.phase ≤ DEPLOYED_PHASE`.
3. **Grant union** over the principal's active roles; `DENY` wins (reserved, unused in P1).
4. **Broadest scope wins** → `where` predicate (`own`/`roster`/`organization`).
5. Returned `where` is merged into the query; **RLS is the floor** beneath it. For `create`, FK inputs (e.g. `rosterId`) are validated against scope inside the authorized handler.

The principal is rebuilt from the DB each request ([`principal.ts`](../src/server/auth/principal.ts)), so removal/suspension/demotion takes effect immediately.

---

## 5. Isolation guarantees (defense in depth)

1. Request context (`AsyncLocalStorage`) holds the resolved org.
2. `withOrgTx` opens a transaction and `SET LOCAL app.current_org_id`.
3. RLS `FORCE` on every tenant table; `app_runtime` is `NOBYPASSRLS` — covers nested `include` traversals the app layer can't see.
4. Composite FK guards reject cross-tenant `connect`.
5. Media: private bucket, authorize-then-sign, visibility-enforced, `PENDING` until validated.
6. Audit: append-only (`UPDATE/DELETE` revoked), write-time redaction.

Proven by [`tests/isolation.test.ts`](../tests/isolation.test.ts): scoped lists, no read-by-id leak, forged-`organizationId` rejected, nested-include isolation, cross-tenant `connect` rejected, audit isolation + immutability.

---

## 6. Adversarial-review findings → resolution

| Finding (severity) | Resolution |
|---|---|
| 3 different RLS GUC names (critical) | One constant `ORG_GUC = app.current_org_id`; `db:verify` greps every policy |
| Nested `include`/non-tx reads unscoped (critical) | RLS-everywhere: all reads via `withOrgTx` (A4) |
| JWT org-switch staleness (critical) | JWT holds only `userId`; principal re-derived per request (A11) |
| Cross-tenant FK via `connect` (high) | Composite `(organizationId, id)` FK guards (A5) |
| Media presign ignores visibility (high) | `canReadAsset()` enforces `MediaVisibility` before signing |
| Role/Dept/GameTitle declared global (high) | All org-bearing tables are tenant-scoped + RLS (A8) |
| No resource gates role/matrix changes (critical) | `Role`/`RolePermission`/`Membership` gated + anti-amplification (A12) |
| Hardcoded `Record<Role>` matrix (critical) | Removed; single data-driven gate (A2) |
| Multi-role single `activeRole` (critical) | Principal carries `grants[]` = union of active roles |
| Manager predicate divergence (high) | Roster is the single source of truth (A10) |
| Soft-delete vs unique constraints (high) | Partial unique indexes among live rows (A7) |
| `RolePermission` missing org FK (high) | Org relation + composite FK to Role added |
| Audit JSON redaction infeasible on read (medium) | Redaction at write-time only (A9), unit-tested |
| Membership/org status not gated (medium) | Admission re-checks `ACTIVE` status + `deletedAt` |
| Seed missing most roles (critical deliverable) | Seed creates all 8 roles + a user each |
| RLS/immutability out-of-band (medium) | Committed SQL applied every deploy + CI verify (A13) |

---

## 7. Acceptance checklist

- [x] Multi-tenant schema; every tenant row keyed by `organizationId` (+ indexes)
- [x] RLS enabled + forced; `NOBYPASSRLS` runtime role; canonical GUC + CI check
- [x] Composite cross-tenant FK guards on the Player gravity-well
- [x] Data-driven RBAC matrix + single server-side gate (read **and** mutation)
- [x] Org/user provisioning + first-Super-Admin bootstrap
- [x] Player + Manager CRUD, scope-aware, audited
- [x] Append-only audit log with write-time redaction
- [x] S3 private media, presigned, visibility-enforced
- [x] i18n EN/AR + RTL, externalized strings
- [x] Per-tenant module toggles gating nav + gate
- [x] Cross-tenant isolation test
- [x] Seed: one demo org + one user per role
- [x] End-to-end types; production build + unit tests green
- [x] Run instructions (README)

---

## 8. Known Phase-1 limitations (deliberate)

- **Org switcher UI** is not built (the principal supports multi-org; switching is wired via session `update`). Single-org demo.
- **Media upload UI** and the post-upload **validation Lambda** are plumbing only — the presign + visibility logic exists and is tested; the S3/Lambda infra is a deploy-time concern.
- **Permission-matrix editor UI** is out of scope; grants are seeded. The gate + anti-amplification are ready for it.
- **`no-any` lint rule** for physical RTL classes is a documented convention; wiring the ESLint plugin is a fast follow.
- Isolation test requires a secured test DB (skips otherwise).
