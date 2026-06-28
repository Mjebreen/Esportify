import Link from 'next/link';
import { tenantLoad } from '@/server/action';
import { authorize } from '@/server/authz/gate';
import { requirePrincipal } from '@/server/auth/session';
import { playerOptions } from '@/server/org/options';
import { KitRequestForm } from '@/components/KitRequestForm';

export default async function PortalPage() {
  const principal = await requirePrincipal();
  const can = (r: 'schedule' | 'invoice' | 'trip') => authorize(principal, 'read', r).allowed;

  const schedule = can('schedule')
    ? await tenantLoad('schedule', 'read', ({ tx, where }) =>
        tx.schedule.findMany({ where: { deletedAt: null, ...where }, orderBy: { startAt: 'asc' }, take: 5, select: { id: true, title: true, startAt: true, type: true } }),
      )
    : [];
  const invoices = can('invoice')
    ? await tenantLoad('invoice', 'read', ({ tx, where }) =>
        tx.invoice.findMany({ where: { deletedAt: null, ...where }, orderBy: { issuedAt: 'desc' }, take: 5, select: { id: true, number: true, amount: true, currency: true, status: true } }),
      )
    : [];
  const trips = can('trip')
    ? await tenantLoad('trip', 'read', ({ tx, where }) =>
        tx.trip.findMany({ where: { deletedAt: null, ...where }, orderBy: { departAt: 'asc' }, take: 5, select: { id: true, purpose: true, destination: true, status: true, departAt: true } }),
      )
    : [];

  const kitPlayers = principal.playerId ? await playerOptions() : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-fg">My portal</h1>
      <p className="text-sm text-muted">Your schedule, invoices and travel.</p>

      {kitPlayers.length > 0 && (
        <div className="mt-6">
          <KitRequestForm players={kitPlayers} title="Request team kit" />
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Upcoming schedule" href="/schedule">
          {schedule.length === 0 ? (
            <Empty />
          ) : (
            schedule.map((s) => (
              <Row key={s.id} a={s.title} b={s.startAt.toISOString().slice(0, 10)} />
            ))
          )}
        </Card>
        <Card title="Recent invoices" href="/invoices">
          {invoices.length === 0 ? (
            <Empty />
          ) : (
            invoices.map((i) => <Row key={i.id} a={`#${i.number}`} b={`${i.amount} ${i.currency} · ${i.status}`} />)
          )}
        </Card>
        <Card title="Travel" href="/trips">
          {trips.length === 0 ? (
            <Empty />
          ) : (
            trips.map((t) => <Row key={t.id} a={t.purpose} b={`${t.destination ?? ''} · ${t.status}`} />)
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <Link href={href} className="text-xs text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="truncate text-fg">{a}</span>
      <span className="ms-2 shrink-0 text-xs text-muted">{b}</span>
    </div>
  );
}
function Empty() {
  return <p className="text-sm text-muted">Nothing yet.</p>;
}
