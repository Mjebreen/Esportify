import { tenantLoad } from '@/server/action';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';
import type { Action, Resource } from '@/server/authz/types';
import { requestVisibilityWhere } from '@/modules/requests/server/queries';

export interface CalEvent {
  date: string; // YYYY-MM-DD
  kind: string;
  title: string;
  href: string;
}

/** Bucket by the SERVER-LOCAL calendar day (org-local for this deployment) — using
 * toISOString() would shift late-evening/early-morning events to the wrong UTC day. */
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** How far back the calendar reaches. Unbounded history made the page grow forever. */
const LOOKBACK_DAYS = 60;

/**
 * Unified calendar: deadlines + events aggregated from every module the caller is
 * permitted to read (per-source authorize gate), all scope-filtered. Sources load
 * CONCURRENTLY — the page pays the slowest query, not the sum of all six.
 */
export async function listCalendar(): Promise<CalEvent[]> {
  const principal = await requirePrincipal();
  const allowed = (resource: Resource, action: Action = 'read') => authorize(principal, action, resource).allowed;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const [tasks, requests, schedules, tournaments, trips, bootcamps] = await Promise.all([
    allowed('task')
      ? tenantLoad('task', 'read', ({ tx, where }) =>
          tx.task.findMany({
            where: { deletedAt: null, dueDate: { gte: since }, ...where },
            select: { id: true, title: true, dueDate: true },
          }),
        )
      : [],
    allowed('request')
      ? tenantLoad('request', 'read', ({ tx }) =>
          tx.request.findMany({
            where: { dueDate: { gte: since }, ...requestVisibilityWhere(principal) },
            select: { id: true, title: true, dueDate: true },
          }),
        )
      : [],
    allowed('schedule')
      ? tenantLoad('schedule', 'read', ({ tx, where }) =>
          tx.schedule.findMany({
            where: { deletedAt: null, startAt: { gte: since }, ...where },
            select: { id: true, title: true, startAt: true },
          }),
        )
      : [],
    // Tournaments show on EVERY role's calendar (org-wide, not per-role gated): a
    // manager's uploaded fixtures are visible across the whole org (product
    // requirement). Still honors the per-tenant TOURNAMENTS module toggle; RLS pins
    // to the caller's tenant.
    principal.enabledModules.has('TOURNAMENTS')
      ? withOrgTx(principal.organizationId, (tx) =>
          tx.tournament.findMany({
            where: { deletedAt: null, startDate: { gte: since } },
            select: { id: true, name: true, startDate: true },
          }),
        )
      : [],
    allowed('trip')
      ? tenantLoad('trip', 'read', ({ tx, where }) =>
          tx.trip.findMany({
            where: { deletedAt: null, departAt: { gte: since }, ...where },
            select: { id: true, purpose: true, departAt: true },
          }),
        )
      : [],
    allowed('bootcamp')
      ? tenantLoad('bootcamp', 'read', ({ tx, where }) =>
          tx.bootcamp.findMany({
            where: { deletedAt: null, startDate: { gte: since }, ...where },
            select: { id: true, name: true, startDate: true },
          }),
        )
      : [],
  ]);

  const out: CalEvent[] = [];
  for (const r of tasks) if (r.dueDate) out.push({ date: day(r.dueDate), kind: 'Task', title: r.title, href: '/tasks' });
  for (const r of requests) if (r.dueDate) out.push({ date: day(r.dueDate), kind: 'Request', title: r.title, href: `/requests/${r.id}` });
  for (const r of schedules) out.push({ date: day(r.startAt), kind: 'Schedule', title: r.title, href: '/schedule' });
  for (const r of tournaments) out.push({ date: day(r.startDate), kind: 'Tournament', title: r.name, href: '/tournaments' });
  for (const r of trips) if (r.departAt) out.push({ date: day(r.departAt), kind: 'Trip', title: r.purpose, href: '/trips' });
  for (const r of bootcamps) out.push({ date: day(r.startDate), kind: 'Bootcamp', title: r.name, href: '/bootcamps' });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
