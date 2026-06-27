# Phases 2–4 — modules built on the foundation

All three phases reuse the Phase 1 guarantees unchanged: the `authorize()` gate, `withOrgTx` RLS binding, composite `(organizationId, id)` FK guards, write-time audit, and scoped writes via count-checked `updateMany`. Every new tenant table is in the RLS loop and has FK guards (`prisma/sql/10_security.sql`). `DEPLOYED_PHASE` gates which phase grants are live.

## Phase 2 — the Asana layer
- **Requests** — typed (technical-service/photography/special/travel/merch/general), routed to a department, status `NEW→IN_PROGRESS→BLOCKED→DONE`, priority, due date, **comments / activity feed**, audited. Visibility is a *union* (own + your department's routed requests + org) — built in `requestVisibilityWhere` since the single-scope gate can't express a union.
- **Tasks** — kanban + list, assignee, due date, status; leadership & managers create/assign.
- **Notifications** — in-app, created server-side on assignment/status-change/comment; per-user, mark read / mark all.
- **Calendar** — unified agenda aggregating deadlines + events from every module the caller may read (per-source authorize gate).

## Phase 3 — Manager Workspace
Tournaments · Contracts (+ salary, buyout, prize-split %) · Salaries · Attendance · Performance · Schedule · Bootcamps · Merch (size profiles + jersey entitlements). All built on a **generic CRUD factory** (`src/server/crud/factory.ts`) that bakes in authorize → anchor-scope validation → atomic scoped write → audit. Manager grants are `manage:roster` (scoped to their roster's players via the player→roster→manager relation); salaries are redacted in the audit log.

## Phase 4 — Player Portal · Travel · Billing · Leadership
- **Player Portal** — a player's own schedule, invoices, trips (own-scope reads).
- **Travel** — trips + group bookings (Aviation manages org-wide).
- **Invoices** — billing statements (players read own).
- **Leadership Overview** — org-wide counts + contract-expiry watch (≤90 days), read-across-all.
- **Roster Calculator** — model a lineup vs. active slots, salary budget, and contract end-dates; financials shown only to callers who may read contracts.

## RBAC additions
The matrix in `src/server/authz/catalog.ts` adds phase-tagged grants per role. Highlights: every role can raise requests + see own tasks/notifications + the calendar; department handlers (IT/Marcom/Aviation/Merch) get `request:read/update:department`; managers get `manage:roster` across the Phase-3 entities; players get own-scope reads of performance/invoices/trips/schedule; Marcom gets the org tournament calendar + media library; Aviation manages trips + reads player booking data; Merch manages size/jersey. `DEPLOYED_PHASE=4` activates all of them.

## Coverage notes (honest)
- Phase 3/4 entity tables use hardcoded English labels (the shell, auth, dashboard, and nav are fully EN/AR + RTL). Externalizing every field label is a polish task.
- Contract **clauses**, **flight options** sub-records, media **upload UI**, and the **org-switcher UI** have schema + server support but minimal/no dedicated UI yet.
- The generic factory uses one boundary cast (`as unknown as CrudDelegate`) per entity — the single typed seam, not `any`.
