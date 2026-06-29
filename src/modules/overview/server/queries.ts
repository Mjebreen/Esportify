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

/** Leadership overview — counts + contract-expiry watch, all scope-filtered. */
export async function getOverview(): Promise<Overview> {
  const principal = await requirePrincipal();
  const metrics: Metric[] = [];
  const allows = (r: Resource) => authorize(principal, 'read', r).allowed;

  if (allows('player')) {
    const v = await tenantLoad('player', 'read', ({ tx, where }) => tx.player.count({ where: { deletedAt: null, ...where } }));
    metrics.push({ label: 'Players', value: v });
  }
  if (allows('roster')) {
    const v = await tenantLoad('roster', 'read', ({ tx, where }) => tx.roster.count({ where: { deletedAt: null, ...where } }));
    metrics.push({ label: 'Rosters', value: v });
  }
  if (allows('manager')) {
    const v = await tenantLoad('manager', 'read', ({ tx, where }) => tx.manager.count({ where: { deletedAt: null, ...where } }));
    metrics.push({ label: 'Managers', value: v });
  }
  if (allows('request')) {
    const v = await tenantLoad('request', 'read', ({ tx }) =>
      tx.request.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'BLOCKED'] }, ...requestVisibilityWhere(principal) } }),
    );
    metrics.push({ label: 'Open requests', value: v });
  }
  if (allows('tournament')) {
    const v = await tenantLoad('tournament', 'read', ({ tx, where }) =>
      tx.tournament.count({ where: { deletedAt: null, status: { in: ['UPCOMING', 'ONGOING'] }, ...where } }),
    );
    metrics.push({ label: 'Active tournaments', value: v });
  }

  let expiring: ExpiringContract[] = [];
  if (allows('contract')) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const [rows, total] = await tenantLoad('contract', 'read', ({ tx, where }) =>
      Promise.all([
        tx.contract.findMany({
          where: { deletedAt: null, status: { in: ['ACTIVE', 'DRAFT'] }, endDate: { lte: horizon }, ...where },
          orderBy: { endDate: 'asc' },
          take: 10,
          select: { endDate: true, status: true, player: { select: { inGameName: true } } },
        }),
        tx.contract.count({ where: { deletedAt: null, status: { in: ['ACTIVE', 'DRAFT'] }, endDate: { lte: horizon }, ...where } }),
      ]),
    );
    expiring = rows.map((r) => ({ player: r.player.inGameName, endDate: r.endDate.toISOString().slice(0, 10), status: r.status }));
    metrics.push({ label: 'Contracts expiring ≤90d', value: total }); // count, not the take:10 list length
  }

  return { metrics, expiring };
}
