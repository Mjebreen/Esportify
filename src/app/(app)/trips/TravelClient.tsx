'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plane, Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { bookTravel, createTravelRequest } from '@/modules/travel/actions';
import type { TravelCard } from '@/modules/travel/queries';

interface Props {
  travel: TravelCard[];
  canCreate: boolean;
  passengers: Array<{ value: string; label: string }>;
}

const NEW = { departure: '', destination: '', hotelNeeded: false, departAt: '', returnAt: '', notes: '' };

export function TravelClient({ travel, canCreate, passengers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...NEW });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState<string | null>(null);
  const [bform, setBForm] = useState({ airline: '', flightNo: '', departAt: '', arriveAt: '', price: '', hotelName: '', hotelNotes: '' });
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? ok ?? null : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });

  function submit() {
    if (picked.size === 0 || !form.departure || !form.destination) return;
    run(
      () =>
        createTravelRequest({
          passengerIds: [...picked],
          departure: form.departure,
          destination: form.destination,
          hotelNeeded: form.hotelNeeded,
          departAt: form.departAt ? new Date(form.departAt) : null,
          returnAt: form.returnAt ? new Date(form.returnAt) : null,
          notes: form.notes || null,
        }).then((r) => {
          if (r.ok) {
            setForm({ ...NEW });
            setPicked(new Set());
            setOpen(false);
          }
          return r;
        }),
      'Travel request submitted for approval',
    );
  }

  function book(id: string) {
    run(
      () =>
        bookTravel({
          id,
          airline: bform.airline || undefined,
          flightNo: bform.flightNo || undefined,
          departAt: bform.departAt || undefined,
          arriveAt: bform.arriveAt || undefined,
          price: bform.price ? Number(bform.price) : undefined,
          hotelName: bform.hotelName || undefined,
          hotelNotes: bform.hotelNotes || undefined,
        }).then((r) => {
          if (r.ok) {
            setBooking(null);
            setBForm({ airline: '', flightNo: '', departAt: '', arriveAt: '', price: '', hotelName: '', hotelNotes: '' });
          }
          return r;
        }),
      'Travel booked',
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Travel</h1>
          <p className="mt-0.5 text-sm text-muted">Manager uploads → Esports Manager approves → Aviation books</p>
        </div>
        {canCreate && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" /> New travel request
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {open && (
        <div className="card mt-4 p-5">
          <div className="text-sm font-medium text-fg">Passengers</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {passengers.map((p) => {
              const on = picked.has(p.value);
              return (
                <button
                  key={p.value}
                  onClick={() => { const n = new Set(picked); on ? n.delete(p.value) : n.add(p.value); setPicked(n); }}
                  className={`rounded-lg border px-2.5 py-1 text-sm ${on ? 'border-accent bg-accent/10 text-accent' : 'text-fg hover:bg-surface-2'}`}
                >
                  {p.label}
                </button>
              );
            })}
            {passengers.length === 0 && <span className="text-sm text-muted">No roster players available.</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Departure airport/city</span><input value={form.departure} onChange={(e) => setForm({ ...form, departure: e.target.value })} className="field" /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Destination</span><input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="field" /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Depart date</span><input type="date" value={form.departAt} onChange={(e) => setForm({ ...form, departAt: e.target.value })} className="field" /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Return date</span><input type="date" value={form.returnAt} onChange={(e) => setForm({ ...form, returnAt: e.target.value })} className="field" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hotelNeeded} onChange={(e) => setForm({ ...form, hotelNeeded: e.target.checked })} /> Hotel needed</label>
            <label className="col-span-full flex flex-col gap-1 text-sm"><span className="text-muted">Notes / extras</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field min-h-16" /></label>
          </div>
          <div className="mt-3">
            <button onClick={submit} disabled={pending || picked.size === 0 || !form.departure || !form.destination} className="btn-primary">Submit for approval</button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {travel.length === 0 && <p className="text-sm text-muted">No travel requests visible to your role.</p>}
        {travel.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-muted" />
                <span className="font-medium text-fg">{t.departure} → {t.destination}</span>
                <Badge tone={statusTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
                {t.hotelNeeded && <Badge tone="info">Hotel</Badge>}
              </div>
              {t.canBook && (
                <button onClick={() => setBooking(booking === t.id ? null : t.id)} className="btn-outline px-2.5 py-1.5">Book</button>
              )}
            </div>
            <div className="mt-1 text-xs text-muted">
              {t.passengers} · by {t.requester}{t.departAt ? ` · ${t.departAt}` : ''}{t.returnAt ? ` → ${t.returnAt}` : ''}
              {t.notes ? ` · ${t.notes}` : ''}
            </div>
            {t.booking && (
              <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg">
                ✈ {t.booking.airline ?? ''} {t.booking.flightNo ?? ''} {t.booking.departAt ?? ''}{t.booking.price ? ` · ${t.booking.price} ${t.booking.currency ?? ''}` : ''}
                {t.booking.hotelName ? ` · 🏨 ${t.booking.hotelName}` : ''}
              </div>
            )}
            {booking === t.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input value={bform.airline} onChange={(e) => setBForm({ ...bform, airline: e.target.value })} placeholder="Airline" className="field" />
                <input value={bform.flightNo} onChange={(e) => setBForm({ ...bform, flightNo: e.target.value })} placeholder="Flight #" className="field" />
                <input value={bform.price} onChange={(e) => setBForm({ ...bform, price: e.target.value })} type="number" placeholder="Price" className="field" />
                <input value={bform.departAt} onChange={(e) => setBForm({ ...bform, departAt: e.target.value })} placeholder="Depart (e.g. 2026-07-01 09:00)" className="field" />
                <input value={bform.hotelName} onChange={(e) => setBForm({ ...bform, hotelName: e.target.value })} placeholder="Hotel" className="field" />
                <button onClick={() => book(t.id)} disabled={pending} className="btn-primary">Confirm booking</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
