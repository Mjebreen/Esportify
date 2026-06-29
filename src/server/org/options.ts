import { tenantLoad } from '@/server/action';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';
import type { Action, Resource } from '@/server/authz/types';

export interface Option {
  value: string;
  label: string;
}

/** True if the current principal may perform action on resource (for UI gating). */
export async function can(resource: Resource, action: Action): Promise<boolean> {
  const principal = await requirePrincipal();
  return authorize(principal, action, resource).allowed;
}

/** Players the caller may see — for playerId pickers (scope-filtered). */
export async function playerOptions(): Promise<Option[]> {
  const rows = await tenantLoad('player', 'read', ({ tx, where }) =>
    tx.player.findMany({
      where: { deletedAt: null, ...where },
      select: { id: true, inGameName: true, firstName: true, lastName: true },
      orderBy: { inGameName: 'asc' },
    }),
  );
  return rows.map((p) => ({ value: p.id, label: `${p.inGameName} (${p.firstName} ${p.lastName})` }));
}

export async function rosterOptions(): Promise<Option[]> {
  const rows = await tenantLoad('roster', 'read', ({ tx, where }) =>
    tx.roster.findMany({ where: { deletedAt: null, ...where }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  );
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

/** Practice/scrim sessions the caller may see — for tying attendance to a session. */
export async function scheduleOptions(): Promise<Option[]> {
  const rows = await tenantLoad('schedule', 'read', ({ tx, where }) =>
    tx.schedule.findMany({
      where: { deletedAt: null, type: { in: ['PRACTICE', 'SCRIM'] }, ...where },
      select: { id: true, title: true, startAt: true, type: true },
      orderBy: { startAt: 'desc' },
      take: 100,
    }),
  );
  return rows.map((s) => ({ value: s.id, label: `${s.title} · ${s.type} · ${s.startAt.toISOString().slice(0, 10)}` }));
}

export async function gameTitleOptions(): Promise<Option[]> {
  const rows = await tenantLoad('gameTitle', 'read', ({ tx, where }) =>
    tx.gameTitle.findMany({ where: { deletedAt: null, ...where }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  );
  return rows.map((g) => ({ value: g.id, label: g.name }));
}
