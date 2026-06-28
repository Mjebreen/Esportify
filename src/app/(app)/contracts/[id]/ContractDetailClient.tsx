'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addClause, deleteClause } from '@/modules/contracts/clauses';
import type { ContractDetail } from '@/modules/contracts/queries';

export function ContractDetailClient({ contract, canEdit }: { contract: ContractDetail; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    if (!title.trim() || !body.trim()) return;
    startTransition(async () => {
      const res = await addClause({ contractId: contract.id, title, body });
      if (res.ok) {
        setTitle('');
        setBody('');
        router.refresh();
      } else setMessage(res.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteClause({ id, contractId: contract.id });
      if (res.ok) router.refresh();
      else setMessage(res.error);
    });
  }

  const facts: Array<[string, string]> = [
    ['Player', contract.player],
    ['Status', contract.status],
    ['Term', `${contract.startDate} → ${contract.endDate}`],
    ['Salary', contract.salaryAmount ? `${contract.salaryAmount} ${contract.currency}` : '—'],
    ['Buyout', contract.buyout ? `${contract.buyout} ${contract.currency}` : '—'],
    ['Prize split', contract.prizeSplitPct ? `${contract.prizeSplitPct}%` : '—'],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/contracts" className="text-sm text-accent hover:underline">
        ← Contracts
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-fg">Contract · {contract.player}</h1>

      <div className="mt-4 grid gap-3 card p-5 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
            <div className="text-sm font-medium text-fg">{v}</div>
          </div>
        ))}
        {contract.notes && (
          <div className="sm:col-span-3">
            <div className="text-xs uppercase tracking-wide text-muted">Notes</div>
            <div className="text-sm text-fg">{contract.notes}</div>
          </div>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface-2 px-3 py-2 text-sm">{message}</p>}

      <h2 className="mt-8 text-sm font-semibold text-fg">Clauses</h2>
      <ul className="mt-3 space-y-2">
        {contract.clauses.length === 0 && <li className="text-sm text-muted">No clauses yet.</li>}
        {contract.clauses.map((c) => (
          <li key={c.id} className="rounded-lg border bg-surface p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fg">{c.title}</span>
              {canEdit && (
                <button onClick={() => remove(c.id)} disabled={pending} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              )}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-muted">{c.body}</div>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-4 card p-4">
          <div className="grid gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clause title" className="field" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Clause text" className="field min-h-20" />
            <div>
              <button onClick={add} disabled={pending} className="btn-primary">
                Add clause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
