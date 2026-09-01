import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';
import { getOverview } from '@/modules/overview/server/queries';
import { rosterRecords, type RosterRecord } from '@/modules/results/queries';

export default async function OverviewPage() {
  // Align page access with the nav gate (contract:read) so a self-scoped role
  // can't direct-URL into a misleading "Leadership overview".
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'contract').allowed) notFound();
  const canResults = authorize(principal, 'read', 'matchResult').allowed;
  const [{ metrics, expiring }, records] = await Promise.all([
    getOverview(),
    canResults ? rosterRecords(90) : Promise.resolve([] as RosterRecord[]),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-fg">Leadership overview</h1>
      <p className="text-sm text-muted">Org-wide snapshot — read across all rosters.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <div className="text-3xl font-semibold text-fg">{m.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted">{m.label}</div>
          </div>
        ))}
      </div>

      {records.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-fg">
            <Link href="/results" className="hover:text-accent hover:underline">
              Win rates — last 90 days
            </Link>
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {records.map((r) => (
              <div key={r.rosterId} className="card flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm font-medium text-fg">{r.roster}</span>
                <span className="text-xs tabular-nums text-muted">
                  {r.wins}W–{r.losses}L{r.draws ? `–${r.draws}D` : ''}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    r.winRate !== null && r.winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {r.winRate !== null ? `${r.winRate}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-fg">Contracts expiring within 90 days</h2>
      <div className="mt-3 card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 text-start">Player</th>
              <th className="px-4 py-2 text-start">Status</th>
              <th className="px-4 py-2 text-start">Ends</th>
            </tr>
          </thead>
          <tbody>
            {expiring.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  No contracts expiring soon.
                </td>
              </tr>
            )}
            {expiring.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{c.player}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2 text-muted">{c.endDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
