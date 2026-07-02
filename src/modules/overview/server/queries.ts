import { tenantLoad } from '@/server/action';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';
import type { Resource } from '@/server/authz/types';
import { requestVisibilityWhere } from '@/modules/requests/server/queries';

export interface Metric {
  label: string;
  value: number;
}

export interface ExpiringContract {
  player: string;
  endDate: string;
  status: string;
}

export interface Overview {
  metrics: Metric[];
  expiring: ExpiringContract[];
}

/** Leadership overview — counts + contract-expiry watch, all scope-filtered.
 * Independent counts load CONCURRENTLY (the page pays the slowest, not the sum). */
export async function getOverview(): Promise<Overview> {
  const principal = await requirePrincipal();
  const allows = (r: Resource) => authorize(principal, 'read', r).allowed;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);

  const [players, rosters, managers, requests, tournaments, contractData] = await Promise.all([
    allows('player') ? tenantLoad('player', 'read', ({ tx, where }) => tx.player.count({ where: { deletedAt: null, ...where } })) : null,
    allows('roster') ? tenantLoad('roster', 'read', ({ tx, where }) => tx.roster.count({ where: { deletedAt: null, ...where } })) : null,
    allows('manager') ? tenantLoad('manager', 'read', ({ tx, where }) => tx.manager.count({ where: { deletedAt: null, ...where } })) : null,
    allows('request')
      ? tenantLoad('request', 'read', ({ tx }) =>
          tx.request.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'BLOCKED'] }, ...requestVisibilityWhere(principal) } }),
        )
      : null,
    allows('tournament')
      ? tenantLoad('tournament', 'read', ({ tx, where }) =>
          tx.tournament.count({ where: { deletedAt: null, status: { in: ['UPCOMING', 'ONGOING'] }, ...where } }),
        )
      : null,
    allows('contract')
      ? tenantLoad('contract', 'read', ({ tx, where }) =>
          Promise.all([
            tx.contract.findMany({
              where: { deletedAt: null, status: { in: ['ACTIVE', 'DRAFT'] }, endDate: { lte: horizon }, ...where },
              orderBy: { endDate: 'asc' },
              take: 10,
              select: { endDate: true, status: true, player: { select: { inGameName: true } } },
            }),
            tx.contract.count({ where: { deletedAt: null, status: { in: ['ACTIVE', 'DRAFT'] }, endDate: { lte: horizon }, ...where } }),
          ]),
        )
      : null,
  ]);

  const metrics: Metric[] = [];
  if (players !== null) metrics.push({ label: 'Players', value: players });
  if (rosters !== null) metrics.push({ label: 'Rosters', value: rosters });
  if (managers !== null) metrics.push({ label: 'Managers', value: managers });
  if (requests !== null) metrics.push({ label: 'Open requests', value: requests });
  if (tournaments !== null) metrics.push({ label: 'Active tournaments', value: tournaments });

  let expiring: ExpiringContract[] = [];
  if (contractData) {
    const [rows, total] = contractData;
    expiring = rows.map((r) => ({ player: r.player.inGameName, endDate: r.endDate.toISOString().slice(0, 10), status: r.status }));
    metrics.push({ label: 'Contracts expiring ≤90d', value: total }); // count, not the take:10 list length
  }

  return { metrics, expiring };
}
