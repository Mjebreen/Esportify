'use server';

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { tenantLoad } from './action';
import { authorize } from './authz/gate';
import { getCurrentPrincipal } from './auth/session';
import { requestVisibilityWhere } from '@/modules/requests/server/queries';

export interface SearchHit {
  label: string;
  sublabel: string | null;
  href: string;
}
export interface SearchGroup {
  kind: string;
  hits: SearchHit[];
}

const qSchema = z.string().trim().min(2).max(80);

/**
 * Cross-module search for the Ctrl+K palette. Every source sits behind its own
 * authorize gate + scope WHERE, so a role only ever matches rows it could open.
 */
export async function globalSearch(rawQ: string): Promise<SearchGroup[]> {
  const parsed = qSchema.safeParse(rawQ);
  if (!parsed.success) return [];
  const q = parsed.data;
  const principal = await getCurrentPrincipal();
  if (!principal) return [];
  const allowed = (r: Parameters<typeof authorize>[2]) => authorize(principal, 'read', r).allowed;
  const ci = { contains: q, mode: 'insensitive' as const };

  const [players, rosters, requests, tasks, tournaments] = await Promise.all([
    allowed('player')
      ? tenantLoad('player', 'read', ({ tx, where }) =>
          tx.player.findMany({
            where: { deletedAt: null, OR: [{ inGameName: ci }, { firstName: ci }, { lastName: ci }], ...(where as Prisma.PlayerWhereInput) },
            take: 5,
            select: { id: true, inGameName: true, firstName: true, lastName: true },
          }),
        )
      : [],
    allowed('roster')
      ? tenantLoad('roster', 'read', ({ tx, where }) =>
          tx.roster.findMany({
            where: { deletedAt: null, name: ci, ...(where as Prisma.RosterWhereInput) },
            take: 5,
            select: { id: true, name: true, gameTitle: { select: { name: true } } },
          }),
        )
      : [],
    allowed('request')
      ? tenantLoad('request', 'read', ({ tx }) =>
          tx.request.findMany({
            where: { title: ci, ...requestVisibilityWhere(principal) },
            take: 5,
            select: { id: true, title: true, status: true },
          }),
        )
      : [],
    allowed('task')
      ? tenantLoad('task', 'read', ({ tx, where }) =>
          tx.task.findMany({
            where: { deletedAt: null, title: ci, ...(where as Prisma.TaskWhereInput) },
            take: 5,
            select: { id: true, title: true, status: true },
          }),
        )
      : [],
    allowed('tournament')
      ? tenantLoad('tournament', 'read', ({ tx, where }) =>
          tx.tournament.findMany({
            where: { deletedAt: null, name: ci, ...(where as Prisma.TournamentWhereInput) },
            take: 5,
            select: { id: true, name: true, status: true },
          }),
        )
      : [],
  ]);

  const groups: SearchGroup[] = [
    { kind: 'Players', hits: players.map((p) => ({ label: p.inGameName, sublabel: `${p.firstName} ${p.lastName}`, href: `/players/${p.id}` })) },
    { kind: 'Rosters', hits: rosters.map((r) => ({ label: r.name, sublabel: r.gameTitle.name, href: '/players' })) },
    { kind: 'Requests', hits: requests.map((r) => ({ label: r.title, sublabel: r.status, href: `/requests/${r.id}` })) },
    { kind: 'Tasks', hits: tasks.map((t) => ({ label: t.title, sublabel: t.status, href: '/tasks' })) },
    { kind: 'Tournaments', hits: tournaments.map((t) => ({ label: t.name, sublabel: t.status, href: '/tournaments' })) },
  ];
  return groups.filter((g) => g.hits.length > 0);
}
