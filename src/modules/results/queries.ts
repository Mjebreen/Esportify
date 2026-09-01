import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface RosterRecord {
  rosterId: string;
  roster: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  /** 0–100, wins over decided games (draws excluded); null when nothing played. */
  winRate: number | null;
}

/** W/L record per roster over the trailing window, scope-filtered by the caller's grant. */
export async function rosterRecords(windowDays = 90): Promise<RosterRecord[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const rows = await tenantLoad('matchResult', 'read', ({ tx, where }) =>
    tx.matchResult.findMany({
      where: { deletedAt: null, playedAt: { gte: since }, ...(where as Prisma.MatchResultWhereInput) },
      select: { rosterId: true, ourScore: true, theirScore: true, roster: { select: { name: true } } },
    }),
  );

  const byRoster = new Map<string, RosterRecord>();
  for (const r of rows) {
    const rec = byRoster.get(r.rosterId) ?? { rosterId: r.rosterId, roster: r.roster.name, wins: 0, losses: 0, draws: 0, played: 0, winRate: null };
    rec.played += 1;
    if (r.ourScore > r.theirScore) rec.wins += 1;
    else if (r.ourScore < r.theirScore) rec.losses += 1;
    else rec.draws += 1;
    byRoster.set(r.rosterId, rec);
  }
  for (const rec of byRoster.values()) {
    const decided = rec.wins + rec.losses;
    rec.winRate = decided > 0 ? Math.round((rec.wins / decided) * 100) : null;
  }
  return [...byRoster.values()].sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));
}
