'use client';

import { useMemo, useState } from 'react';
import type { RosterCalcData } from '@/modules/roster-calculator/server/queries';

export function RosterCalculatorClient({ data }: { data: RosterCalcData }) {
  const [rosterId, setRosterId] = useState(data.rosters[0]?.id ?? '');
  const [budget, setBudget] = useState('');
  const [targetSlots, setTargetSlots] = useState('5');
  const [selected, setSelected] = useState<Set<string>>(new Set(data.rosters[0]?.players.map((p) => p.id) ?? []));

  const roster = data.rosters.find((r) => r.id === rosterId);

  function pickRoster(id: string) {
    setRosterId(id);
    const r = data.rosters.find((x) => x.id === id);
    setSelected(new Set(r?.players.map((p) => p.id) ?? []));
  }

  const lineup = useMemo(() => (roster?.players ?? []).filter((p) => selected.has(p.id)), [roster, selected]);
  const totalSalary = lineup.reduce((sum, p) => sum + (p.salary ?? 0), 0);
  const budgetNum = Number(budget) || 0;
  const remaining = budgetNum - totalSalary;
  const slots = Number(targetSlots) || 0;
  const currency = lineup.find((p) => p.currency)?.currency ?? 'SAR';

  const expiring = lineup
    .filter((p) => p.contractEnd)
    .map((p) => p.contractEnd!)
    .sort();
  const earliest = expiring[0] ?? null;

  const warnings: string[] = [];
  if (data.canSalary && budgetNum > 0 && remaining < 0) warnings.push(`Over budget by ${(-remaining).toLocaleString()} ${currency}`);
  if (lineup.length > slots) warnings.push(`Lineup (${lineup.length}) exceeds active slots (${slots})`);
  if (lineup.length < slots) warnings.push(`Lineup (${lineup.length}) below target slots (${slots})`);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-fg">Roster Calculator</h1>
      <p className="text-sm text-muted">Model a lineup against slot, budget & contract constraints.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Roster</span>
          <select value={rosterId} onChange={(e) => pickRoster(e.target.value)} className="rounded-md border bg-surface px-3 py-2">
            {data.rosters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Active slots</span>
          <input type="number" value={targetSlots} onChange={(e) => setTargetSlots(e.target.value)} className="rounded-md border bg-surface px-3 py-2" />
        </label>
        {data.canSalary && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Budget ({currency})</span>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-md border bg-surface px-3 py-2" />
          </label>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 overflow-hidden rounded-xl border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b bg-bg text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-start">In</th>
                <th className="px-3 py-2 text-start">Player</th>
                <th className="px-3 py-2 text-start">Status</th>
                {data.canSalary && <th className="px-3 py-2 text-start">Salary</th>}
                {data.canSalary && <th className="px-3 py-2 text-start">Contract ends</th>}
              </tr>
            </thead>
            <tbody>
              {(roster?.players ?? []).map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{p.ign}</td>
                  <td className="px-3 py-2 text-muted">{p.status}</td>
                  {data.canSalary && <td className="px-3 py-2">{p.salary != null ? p.salary.toLocaleString() : '—'}</td>}
                  {data.canSalary && <td className="px-3 py-2 text-muted">{p.contractEnd ?? '—'}</td>}
                </tr>
              ))}
              {(roster?.players.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    No players on this roster.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-surface p-5 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted">Lineup</div>
          <div className="mt-1 text-2xl font-semibold text-fg">
            {lineup.length} / {slots}
          </div>
          {data.canSalary && (
            <>
              <div className="mt-4 text-xs uppercase tracking-wide text-muted">Total salary</div>
              <div className="text-lg font-medium">
                {totalSalary.toLocaleString()} {currency}
              </div>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted">Remaining vs budget</div>
              <div className={`text-lg font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {remaining.toLocaleString()} {currency}
              </div>
            </>
          )}
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">Earliest contract expiry</div>
          <div className="font-medium">{earliest ?? '—'}</div>

          {warnings.length > 0 && (
            <ul className="mt-4 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
