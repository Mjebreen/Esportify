'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Shirt } from 'lucide-react';
import { submitKitRequest } from '@/modules/merch/kit';

interface Props {
  players: Array<{ value: string; label: string }>;
  title?: string;
}

export function KitRequestForm({ players, title = 'Request kit' }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [playerId, setPlayerId] = useState(players.length === 1 ? players[0]!.value : '');
  const [jerseyName, setJerseyName] = useState('');
  const [size, setSize] = useState('');
  const [kitType, setKitType] = useState('JERSEY');
  const [message, setMessage] = useState<string | null>(null);

  if (players.length === 0) return null;

  function submit() {
    if (!playerId || !jerseyName.trim()) return;
    startTransition(async () => {
      const res = await submitKitRequest({ playerId, jerseyName, size: size || undefined, kitType: kitType as 'JERSEY' });
      if (res.ok) {
        setJerseyName('');
        setSize('');
        setMessage('Request submitted');
        router.refresh();
      } else {
        setMessage(res.error ?? 'Error');
      }
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        <Shirt className="h-4 w-4 text-muted" /> {title}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {players.length > 1 ? (
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="field">
            <option value="">Player…</option>
            {players.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        ) : (
          <input value={players[0]!.label} disabled className="field opacity-70" />
        )}
        <input value={jerseyName} onChange={(e) => setJerseyName(e.target.value)} placeholder="Name on jersey" className="field" />
        <select value={kitType} onChange={(e) => setKitType(e.target.value)} className="field">
          {['JERSEY', 'JACKET', 'TRAINING', 'OTHER'].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size (e.g. L)" className="field" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={submit} disabled={pending || !jerseyName.trim()} className="btn-primary">
          Submit request
        </button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </div>
  );
}
