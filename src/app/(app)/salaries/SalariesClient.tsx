'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import { Plus, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { addSalaryAdjustment } from '@/modules/salaries/adjustments';
import type { AdjustmentRow, PayrollRow } from '@/modules/salaries/payroll';

interface Props {
  canAdjust: boolean;
  canSeePayroll: boolean;
  period: string;
  players: Array<{ value: string; label: string }>;
  adjustments: AdjustmentRow[];
  payroll: PayrollRow[];
}

const money = (n: number, c: string) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${c}`;

export function SalariesClient({ canAdjust, canSeePayroll, period, players, adjustments, payroll }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ playerId: '', kind: 'WINNING', amount: '', period, reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function submit() {
    if (!form.playerId || !form.amount) return;
    startTransition(async () => {
      const res = await addSalaryAdjustment({
        playerId: form.playerId,
        kind: form.kind as 'WINNING' | 'CUT',
        amount: Number(form.amount),
        period: form.period,
        reason: form.reason || null,
      });
      if (res.ok) {
        setForm({ playerId: '', kind: 'WINNING', amount: '', period, reason: '' });
        setOpen(false);
        setMessage('Adjustment submitted for Esports Manager approval');
        router.refresh();
      } else {
        setMessage(res.error ?? 'Error');
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Salaries</h1>
          <p className="mt-0.5 text-sm text-muted">Base salary lives on the contract · monthly winnings/cuts need Esports Manager approval before they reach Finance</p>
        </div>
        {canAdjust && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add winning / cut
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {open && (
        <div className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Player</span>
            <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} className="field">
              <option value="">Pick a player…</option>
              {players.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Type</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="field">
              <option value="WINNING">Winning (add)</option>
              <option value="CUT">Cut (deduct)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Amount</span><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Month</span><input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="field" /></label>
          <label className="col-span-full flex flex-col gap-1 text-sm"><span className="text-muted">Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="field" placeholder="e.g. Tournament prize, fine for missed practice" /></label>
          <div className="col-span-full">
            <button onClick={submit} disabled={pending || !form.playerId || !form.amount} className="btn-primary">Submit for approval</button>
          </div>
        </div>
      )}

      {canSeePayroll && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Payroll</h2>
            <label className="flex items-center gap-2 text-sm text-muted">
              Month
              <input
                type="month"
                value={period}
                onChange={(e) => router.push(`/salaries?period=${e.target.value}`)}
                className="field py-1"
              />
            </label>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 text-start">Player</th>
                  <th className="px-4 py-2 text-start">Roster</th>
                  <th className="px-4 py-2 text-end">Base</th>
                  <th className="px-4 py-2 text-end">Winnings</th>
                  <th className="px-4 py-2 text-end">Cuts</th>
                  <th className="px-4 py-2 text-end">Net payout</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {payroll.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No payroll for {period}.</td></tr>
                )}
                {payroll.map((r) => (
                  <Fragment key={r.playerId}>
                    <tr className="border-b last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-2 font-medium text-fg">{r.player}</td>
                      <td className="px-4 py-2 text-muted">{r.roster}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{money(r.base, r.currency)}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-emerald-600 dark:text-emerald-400">{r.winnings ? `+${money(r.winnings, r.currency)}` : '—'}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-red-600 dark:text-red-400">{r.cuts ? `−${money(r.cuts, r.currency)}` : '—'}</td>
                      <td className="px-4 py-2 text-end font-semibold tabular-nums text-fg">{money(r.net, r.currency)}</td>
                      <td className="px-4 py-2 text-end">
                        {r.lines.length > 0 && (
                          <button onClick={() => setExpanded(expanded === r.playerId ? null : r.playerId)} className="text-muted hover:text-fg">
                            <ChevronRight className={`h-4 w-4 transition-transform ${expanded === r.playerId ? 'rotate-90' : ''}`} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === r.playerId && r.lines.map((l, i) => (
                      <tr key={`${r.playerId}-${i}`} className="border-b last:border-0 bg-surface-2/30 text-xs">
                        <td className="px-4 py-1.5 ps-8 text-muted" colSpan={2}>
                          <span className="inline-flex items-center gap-1.5">
                            {l.kind === 'WINNING' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                            {l.reason || (l.kind === 'WINNING' ? 'Winning' : 'Cut')}
                          </span>
                        </td>
                        <td colSpan={3} />
                        <td className={`px-4 py-1.5 text-end tabular-nums ${l.kind === 'WINNING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {l.kind === 'WINNING' ? '+' : '−'}{money(l.amount, r.currency)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold text-fg">Adjustments</h2>
        <div className="space-y-2">
          {adjustments.length === 0 && <p className="text-sm text-muted">No adjustments yet.</p>}
          {adjustments.map((a) => (
            <div key={a.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {a.kind === 'WINNING' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className="font-medium text-fg">{a.kind === 'WINNING' ? '+' : '−'}{money(a.amount, a.currency)} · {a.player}</span>
                  <Badge tone={statusTone(a.status)}>{a.status.replace('_', ' ')}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">{a.period}{a.reason ? ` · ${a.reason}` : ''} · by {a.requester}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
