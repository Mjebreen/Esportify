import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';

export interface CalcPlayer {
  id: string;
  ign: string;
  status: string;
  salary: number | null;
  currency: string | null;
  contractEnd: string | null;
}
export interface CalcRoster {
  id: string;
  name: string;
  title: string;
  players: CalcPlayer[];
}
export interface RosterCalcData {
  canSalary: boolean;
  rosters: CalcRoster[];
}

/**
 * Data for the Roster Calculator. Salary/contract figures are included ONLY if the
 * caller may read contracts; others get a lineup/slot view without financials.
 */
export async function getRosterCalcData(): Promise<RosterCalcData> {
  const principal = await requirePrincipal();
  const canSalary = authorize(principal, 'read', 'contract').allowed;
  // The calculator is built on the roster list; a caller who can't read rosters
  // (e.g. Finance, a Player) gets an empty view rather than a 500.
  if (!authorize(principal, 'read', 'roster').allowed) return { canSalary: false, rosters: [] };

  const playerSelect: Prisma.PlayerSelect = {
    id: true,
    inGameName: true,
    status: true,
    ...(canSalary
      ? {
          contracts: {
            where: { deletedAt: null, status: 'ACTIVE' },
            orderBy: { endDate: 'desc' },
            take: 1,
            select: { salaryAmount: true, currency: true, endDate: true },
          },
        }
      : {}),
  };

  const rosters = await tenantLoad('roster', 'read', ({ tx, where }) =>
    tx.roster.findMany({
      where: { deletedAt: null, ...where },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        gameTitle: { select: { name: true } },
        players: { where: { deletedAt: null }, orderBy: { inGameName: 'asc' }, select: playerSelect },
      },
    }),
  );

  return {
    canSalary,
    rosters: rosters.map((r) => ({
      id: r.id,
      name: r.name,
      title: r.gameTitle.name,
      players: r.players.map((p) => {
        const contract = (p as { contracts?: Array<{ salaryAmount: Prisma.Decimal | null; currency: string | null; endDate: Date }> }).contracts?.[0];
        return {
          id: p.id,
          ign: p.inGameName,
          status: p.status,
          salary: contract?.salaryAmount ? Number(contract.salaryAmount) : null,
          currency: contract?.currency ?? null,
          contractEnd: contract?.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
        };
      }),
    })),
  };
}
