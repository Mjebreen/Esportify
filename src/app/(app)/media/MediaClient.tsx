'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Camera, Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { createPhotoRequest } from '@/modules/media/photo';
import type { PhotoCard } from '@/modules/media/photo-queries';

interface Props {
  requests: PhotoCard[];
  canCreate: boolean;
  rosters: Array<{ value: string; label: string }>;
}

const NEW = { rosterId: '', kind: 'PHOTOSHOOT', event: '', deadline: '', notes: '' };

export function MediaClient({ requests, canCreate, rosters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...NEW });
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    if (!form.rosterId) return;
    startTransition(async () => {
      const res = await createPhotoRequest({
        rosterId: form.rosterId,
        kind: form.kind as 'PHOTOSHOOT',
        event: form.event || undefined,
        deadline: form.deadline ? new Date(form.deadline) : null,
        notes: form.notes || null,
      });
      if (res.ok) {
        setForm({ ...NEW });
        setOpen(false);
        setMessage('Photography request submitted for approval');
        router.refresh();
      } else {
        setMessage(res.error ?? 'Error');
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Media</h1>
          <p className="mt-0.5 text-sm text-muted">Photoshoots & media days — Marcom/Manager request → Esports approves → Marcom delivers</p>
        </div>
        {canCreate && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" /> New photo request
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {open && (
        <div className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Roster</span>
            <select value={form.rosterId} onChange={(e) => setForm({ ...form, rosterId: e.target.value })} className="field">
              <option value="">Pick a roster…</option>
              {rosters.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Type</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="field">
              {['PHOTOSHOOT', 'MEDIA_DAY', 'CONTENT', 'OTHER'].map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Event</span><input value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className="field" /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-muted">Deadline</span><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="field" /></label>
          <label className="col-span-full flex flex-col gap-1 text-sm"><span className="text-muted">Notes</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field min-h-16" /></label>
          <div className="col-span-full">
            <button onClick={submit} disabled={pending || !form.rosterId} className="btn-primary">Submit for approval</button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {requests.length === 0 && <p className="text-sm text-muted">No photography requests visible to your role.</p>}
        {requests.map((r) => (
          <div key={r.id} className="card flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted" />
                <span className="font-medium text-fg">{r.kind} · {r.roster}</span>
                <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted">
                {r.event ? `${r.event} · ` : ''}by {r.requester}{r.deadline ? ` · due ${r.deadline}` : ''}{r.notes ? ` · ${r.notes}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
