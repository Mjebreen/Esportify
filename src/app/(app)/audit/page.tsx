import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { tenantLoad } from '@/server/action';
import { Badge, statusTone } from '@/components/Badge';

/** The audit trail was write-only until now — leadership/admins get eyes on it. */
export default async function AuditPage() {
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'auditLog').allowed) notFound();

  const rows = await tenantLoad('auditLog', 'read', ({ tx }) =>
    tx.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        subjectType: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Audit log</h1>
      <p className="mt-0.5 text-sm text-muted">Every write, attributed — append-only, redacted at write time. Last 100 events.</p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">When</th>
              <th className="px-4 py-2.5 text-start font-medium">Actor</th>
              <th className="px-4 py-2.5 text-start font-medium">Action</th>
              <th className="px-4 py-2.5 text-start font-medium">Entity</th>
              <th className="px-4 py-2.5 text-start font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No audit events yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-surface-2/60">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="px-4 py-2 font-medium text-fg">{r.actor?.name ?? r.actor?.email ?? 'system'}</td>
                <td className="px-4 py-2">
                  <Badge tone={statusTone(r.action)}>{r.action.replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-2 text-fg/90">{r.entity}</td>
                <td className="px-4 py-2 text-xs text-muted">{r.subjectType ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
