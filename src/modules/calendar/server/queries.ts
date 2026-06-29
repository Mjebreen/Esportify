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

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Unified calendar: deadlines + events aggregated from every module the caller is
 * permitted to read (per-source authorize gate), all scope-filtered.
 */
export async function listCalendar(): Promise<CalEvent[]> {
  const principal = await requirePrincipal();
  const out: CalEvent[] = [];
  const allowed = (resource: Resource, action: Action = 'read') => authorize(principal, action, resource).allowed;

  if (allowed('task')) {
    const rows = await tenantLoad('task', 'read', ({ tx, where }) =>
      tx.task.findMany({ where: { deletedAt: null, dueDate: { not: null }, ...where }, select: { id: true, title: true, dueDate: true } }),
    );
    for (const r of rows) if (r.dueDate) out.push({ date: iso(r.dueDate), kind: 'Task', title: r.title, href: '/tasks' });
  }

  if (allowed('request')) {
    const rows = await tenantLoad('request', 'read', ({ tx }) =>
      tx.request.findMany({ where: { dueDate: { not: null }, ...requestVisibilityWhere(principal) }, select: { id: true, title: true, dueDate: true } }),
    );
    for (const r of rows) if (r.dueDate) out.push({ date: iso(r.dueDate), kind: 'Request', title: r.title, href: `/requests/${r.id}` });
  }

  if (allowed('schedule')) {
    const rows = await tenantLoad('schedule', 'read', ({ tx, where }) =>
      tx.schedule.findMany({ where: { deletedAt: null, ...where }, select: { id: true, title: true, startAt: true } }),
    );
    for (const r of rows) out.push({ date: iso(r.startAt), kind: 'Schedule', title: r.title, href: '/schedule' });
  }

  // Tournaments show on EVERY role's calendar (org-wide, not per-role gated): a
  // manager's uploaded fixtures are visible across the whole org (product requirement).
  // Still honor the per-tenant TOURNAMENTS module toggle; RLS pins to the caller's tenant.
  if (principal.enabledModules.has('TOURNAMENTS')) {
    const rows = await withOrgTx(principal.organizationId, (tx) =>
      tx.tournament.findMany({ where: { deletedAt: null }, select: { id: true, name: true, startDate: true } }),
    );
    for (const r of rows) out.push({ date: iso(r.startDate), kind: 'Tournament', title: r.name, href: '/tournaments' });
  }

  if (allowed('trip')) {
    const rows = await tenantLoad('trip', 'read', ({ tx, where }) =>
      tx.trip.findMany({ where: { deletedAt: null, departAt: { not: null }, ...where }, select: { id: true, purpose: true, departAt: true } }),
    );
    for (const r of rows) if (r.departAt) out.push({ date: iso(r.departAt), kind: 'Trip', title: r.purpose, href: '/trips' });
  }

  if (allowed('bootcamp')) {
    const rows = await tenantLoad('bootcamp', 'read', ({ tx, where }) =>
      tx.bootcamp.findMany({ where: { deletedAt: null, ...where }, select: { id: true, name: true, startDate: true } }),
    );
    for (const r of rows) out.push({ date: iso(r.startDate), kind: 'Bootcamp', title: r.name, href: '/bootcamps' });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
