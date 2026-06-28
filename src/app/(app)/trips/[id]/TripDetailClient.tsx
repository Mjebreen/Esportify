'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addFlight, deleteFlight, selectFlight } from '@/modules/trips/flights';
import type { TripDetail } from '@/modules/trips/queries';

const EMPTY = { airline: '', flightNo: '', departAt: '', arriveAt: '', price: '', currency: 'SAR' };

export function TripDetailClient({ trip, canEdit }: { trip: TripDetail; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ ...EMPTY });
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setMessage(res.error ?? 'Error');
    });

  function add() {
    run(() =>
      addFlight({
        tripId: trip.id,
        airline: f.airline || null,
        flightNo: f.flightNo || null,
        departAt: f.departAt ? new Date(f.departAt) : null,
        arriveAt: f.arriveAt ? new Date(f.arriveAt) : null,
        price: f.price ? Number(f.price) : null,
        currency: f.currency || null,
      }).then((r) => { if (r.ok) setF({ ...EMPTY }); return r; }),
    );
  }

  const facts: Array<[string, string]> = [
    ['Player', trip.player ?? 'Group trip'],
    ['Purpose', trip.purpose],
    ['Route', `${trip.origin ?? '—'} → ${trip.destination ?? '—'}`],
    ['Depart', trip.departAt ?? '—'],
    ['Return', trip.returnAt ?? '—'],
    ['Status', trip.status],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/trips" className="text-sm text-accent hover:underline">
        ← Travel
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-fg">Trip · {trip.purpose}</h1>

      <div className="mt-4 grid gap-3 rounded-xl border bg-surface p-5 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
            <div className="text-sm font-medium text-fg">{v}</div>
          </div>
        ))}
      </div>

      {message && <p className="mt-4 rounded-md border bg-surface px-3 py-2 text-sm">{message}</p>}

      <h2 className="mt-8 text-sm font-semibold text-fg">Flight options</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b bg-bg text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-start">Airline</th>
              <th className="px-3 py-2 text-start">Flight</th>
              <th className="px-3 py-2 text-start">Depart</th>
              <th className="px-3 py-2 text-start">Arrive</th>
              <th className="px-3 py-2 text-start">Price</th>
              <th className="px-3 py-2 text-end">{canEdit ? 'Action' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {trip.flights.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No flight options published yet.
                </td>
              </tr>
            )}
            {trip.flights.map((fl) => (
              <tr key={fl.id} className={`border-b last:border-0 ${fl.selected ? 'bg-green-50' : ''}`}>
                <td className="px-3 py-2 font-medium">{fl.airline ?? '—'}</td>
                <td className="px-3 py-2">{fl.flightNo ?? '—'}</td>
                <td className="px-3 py-2 text-muted">{fl.departAt ?? '—'}</td>
                <td className="px-3 py-2 text-muted">{fl.arriveAt ?? '—'}</td>
                <td className="px-3 py-2">{fl.price ? `${fl.price} ${fl.currency ?? ''}` : '—'}</td>
                <td className="px-3 py-2 text-end">
                  {fl.selected ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Selected</span>
                  ) : (
                    canEdit && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => run(() => selectFlight({ id: fl.id, tripId: trip.id }))} disabled={pending} className="text-accent hover:underline">
                          Select
                        </button>
                        <button onClick={() => run(() => deleteFlight({ id: fl.id, tripId: trip.id }))} disabled={pending} className="text-red-600 hover:underline">
                          Delete
                        </button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-4 grid gap-2 rounded-xl border bg-surface p-4 sm:grid-cols-3">
          <input value={f.airline} onChange={(e) => setF({ ...f, airline: e.target.value })} placeholder="Airline" className="rounded-md border bg-surface px-3 py-2 text-sm" />
          <input value={f.flightNo} onChange={(e) => setF({ ...f, flightNo: e.target.value })} placeholder="Flight #" className="rounded-md border bg-surface px-3 py-2 text-sm" />
          <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} type="number" placeholder="Price" className="rounded-md border bg-surface px-3 py-2 text-sm" />
          <label className="text-xs text-muted">Depart<input value={f.departAt} onChange={(e) => setF({ ...f, departAt: e.target.value })} type="datetime-local" className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm" /></label>
          <label className="text-xs text-muted">Arrive<input value={f.arriveAt} onChange={(e) => setF({ ...f, arriveAt: e.target.value })} type="datetime-local" className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm" /></label>
          <div className="flex items-end">
            <button onClick={add} disabled={pending} className="rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">
              Publish option
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
