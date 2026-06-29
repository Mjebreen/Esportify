import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface PlayerListItem {
  id: string;
  firstName: string;
  lastName: string;
  inGameName: string;
  status: string;
  jerseyNumber: number | null;
  phone: string | null;
  rosterId: string | null;
  rosterName: string | null;
  gameTitleName: string | null;
}

/** List players the caller may read (scope-filtered: own / roster / org). */
export async function listPlayers(): Promise<PlayerListItem[]> {
  return tenantLoad('player', 'read', async ({ tx, where }) => {
    const players = await tx.player.findMany({
      where: { deletedAt: null, ...(where as Prisma.PlayerWhereInput) },
      orderBy: [{ status: 'asc' }, { inGameName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        inGameName: true,
        status: true,
        jerseyNumber: true,
        phone: true,
        rosterId: true,
        roster: { select: { name: true, gameTitle: { select: { name: true } } } },
      },
    });
    return players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      inGameName: p.inGameName,
      status: p.status,
      jerseyNumber: p.jerseyNumber,
      phone: p.phone,
      rosterId: p.rosterId,
      rosterName: p.roster?.name ?? null,
      gameTitleName: p.roster?.gameTitle?.name ?? null,
    }));
  });
}

export interface PlayerDetail {
  id: string;
  firstName: string;
  lastName: string;
  inGameName: string;
  status: string;
  jerseyNumber: number | null;
  email: string | null;
  phone: string | null;
  rosterName: string | null;
}

export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  return tenantLoad('player', 'read', async ({ tx, where }) => {
    const p = await tx.player.findFirst({
      where: { id, deletedAt: null, ...(where as Prisma.PlayerWhereInput) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        inGameName: true,
        status: true,
        jerseyNumber: true,
        email: true,
        phone: true,
        roster: { select: { name: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      inGameName: p.inGameName,
      status: p.status,
      jerseyNumber: p.jerseyNumber,
      email: p.email,
      phone: p.phone,
      rosterName: p.roster?.name ?? null,
    };
  });
}

/** Rosters the caller may assign players to (their own, or all in org for admins). */
export async function listAssignableRosters(): Promise<Array<{ id: string; name: string }>> {
  return tenantLoad('roster', 'read', async ({ tx, where }) => {
    return tx.roster.findMany({
      where: { deletedAt: null, ...(where as Prisma.RosterWhereInput) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  });
}
