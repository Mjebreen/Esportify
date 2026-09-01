'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Inbox, Send, Wrench, X } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { approveWorkflow, executeWorkflow, rejectWorkflow } from '@/server/workflow/actions';
import type { ApprovalCard, ApprovalsView } from '@/modules/approvals/queries';

function roleLabel(r: string | null): string {
  if (!r) return '';
  if (r === 'TEAM_MANAGER') return 'Team Manager';
  if (r === 'ESPORTS_MANAGER') return 'Esports Manager';
  return r.charAt(0) + r.slice(1).toLowerCase();
}

export function ApprovalsClient({ view }: { view: ApprovalsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setMessage(res.error ?? 'Error');
    });

  function reject(id: string) {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // Cancel pressed — do NOT reject
    run(() => rejectWorkflow({ id, reason: reason || undefined }));
  }

  function Card({ card, actions }: { card: ApprovalCard; actions?: React.ReactNode }) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-fg">{card.title}</span>
              <Badge tone="accent">{card.typeLabel}</Badge>
              <Badge tone={statusTone(card.status)}>{card.status.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted">
              {card.subject ? `For ${card.subject} · ` : ''}by {card.requester} · {card.at}
              {card.currentRole ? ` · waiting on ${roleLabel(card.currentRole)}` : ''}
              {card.rejectionReason ? ` · reason: ${card.rejectionReason}` : ''}
            </div>
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
        {card.steps.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted hover:text-fg">Timeline</summary>
            <ol className="mt-2 space-y-1 border-s-2 border-border ps-4">
              {card.steps.map((s, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium text-fg">{roleLabel(s.role)}</span>{' '}
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  {s.actor && <span className="text-muted"> · {s.actor}</span>}
                  {s.at && <span className="text-muted"> · {s.at}</span>}
                  {s.note && <span className="text-muted"> · “{s.note}”</span>}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    );
  }

  function Section({ icon: Icon, title, hint, cards, render }: { icon: typeof Inbox; title: string; hint: string; cards: ApprovalCard[]; render?: (c: ApprovalCard) => React.ReactNode }) {
    return (
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <span className="rounded-md bg-surface-2 px-1.5 text-xs text-muted">{cards.length}</span>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">{hint}</p>
        ) : (
          <div className="space-y-2">{cards.map((c) => <Card key={c.id} card={c} actions={render?.(c)} />)}</div>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Approvals</h1>
      <p className="mt-0.5 text-sm text-muted">Everything waiting on you, across every module.</p>

      {message && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{message}</p>
      )}

      <Section
        icon={Check}
        title="Awaiting your approval"
        hint="Nothing needs your approval right now."
        cards={view.toApprove}
        render={(c) => (
          <>
            <button onClick={() => run(() => approveWorkflow({ id: c.id }))} disabled={pending} className="btn-primary px-2.5 py-1.5">
              <Check className="h-4 w-4" /> Approve
            </button>
            <button onClick={() => reject(c.id)} disabled={pending} className="btn-outline px-2.5 py-1.5 text-red-500">
              <X className="h-4 w-4" /> Reject
            </button>
          </>
        )}
      />

      <Section
        icon={Wrench}
        title="Ready for you to action"
        hint="Nothing to fulfil right now."
        cards={view.toExecute}
        render={(c) => (
          <button onClick={() => run(() => executeWorkflow({ id: c.id }))} disabled={pending} className="btn-primary px-2.5 py-1.5">
            <Wrench className="h-4 w-4" /> Mark done
          </button>
        )}
      />

      <Section icon={Send} title="My submissions" hint="You haven't submitted anything yet." cards={view.mine} />
    </div>
  );
}
