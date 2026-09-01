'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { downloadCsv } from '@/components/csv';
import { createPlayer, deletePlayer, updatePlayer } from '@/modules/players/server/actions';
import type { PlayerListItem } from '@/modules/players/server/queries';

interface Props {
  players: PlayerListItem[];
  rosters: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  /** Non-null for self-service (own scope): the only fields the server will accept. */
  selfEditFields: string[] | null;
}

const STATUSES = ['ACTIVE', 'BENCHED', 'INACTIVE', 'TRIAL', 'FORMER'] as const;

type FormState = {
  id?: string;
  firstName: string;
  lastName: string;
  inGameName: string;
  phone: string;
  rosterId: string;
  origRosterId: string;
  jerseyNumber: string;
  status: (typeof STATUSES)[number];
};

const EMPTY: FormState = { firstName: '', lastName: '', inGameName: '', phone: '', rosterId: '', origRosterId: '', jerseyNumber: '', status: 'ACTIVE' };

export function PlayersClient({ players, rosters, canCreate, canUpdate, canDelete, selfEditFields }: Props) {
  const t = useTranslations('players');
  const c = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function openNew() {
    setMessage(null);
    setForm({ ...EMPTY });
  }
  // Which fields the form may edit. For self-service (selfEditFields non-null) only the
  // allowlisted fields render; for managers/admins (null) everything is editable.
  const show = (field: string) => selfEditFields === null || selfEditFields.includes(field);

  function openEdit(p: PlayerListItem) {
    setMessage(null);
    setForm({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      inGameName: p.inGameName,
      phone: p.phone ?? '',
      rosterId: p.rosterId ?? '',
      origRosterId: p.rosterId ?? '',
      jerseyNumber: p.jerseyNumber?.toString() ?? '',
      status: (p.status as FormState['status']) ?? 'ACTIVE',
    });
  }

  function submit() {
    if (!form) return;
    startTransition(async () => {
      // Only send what this caller may edit; never send rosterId on an edit unless it
      // actually changed (so an unrelated edit never wipes/re-validates the roster).
      const payload: Record<string, unknown> = { firstName: form.firstName, lastName: form.lastName };
      if (show('phone')) payload.phone = form.phone || null;
      if (show('inGameName')) payload.inGameName = form.inGameName;
      if (show('jerseyNumber')) payload.jerseyNumber = form.jerseyNumber ? Number(form.jerseyNumber) : null;
      if (show('status')) payload.status = form.status;
      if (show('rosterId') && (!form.id || form.rosterId !== form.origRosterId)) payload.rosterId = form.rosterId || null;

      const res = form.id
        ? await updatePlayer({ id: form.id, ...payload })
        : await createPlayer(payload as Parameters<typeof createPlayer>[0]);
      if (res.ok) {
        setForm(null);
        setMessage(form.id ? t('updated') : t('created'));
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });
  }

  function remove(id: string) {
    if (!confirm(c('confirmDelete'))) return;
    startTransition(async () => {
      const res = await deletePlayer({ id });
      setMessage(res.ok ? t('deleted') : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {players.length > 0 && (
            <button
              onClick={() =>
                downloadCsv(
                  'players.csv',
                  ['IGN', 'First name', 'Last name', 'Roster', 'Jersey', 'Status', 'Phone'],
                  players.map((p) => [p.inGameName, p.firstName, p.lastName, p.rosterName, p.jerseyNumber, p.status, p.phone]),
                )
              }
              className="btn-outline px-2.5 py-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
          {canCreate && (
            <button onClick={openNew} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t('new')}
            </button>
          )}
        </div>
      </div>

      {message && <p className="mt-4 rounded-md border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {form && (
        <div className="mt-4 card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('firstName')} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
            <Field label={t('lastName')} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
            {show('phone') && <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />}
            {show('inGameName') && (
              <Field label={t('inGameName')} value={form.inGameName} onChange={(v) => setForm({ ...form, inGameName: v })} />
            )}
            {show('jerseyNumber') && (
              <Field label={t('jersey')} value={form.jerseyNumber} onChange={(v) => setForm({ ...form, jerseyNumber: v })} />
            )}
            {show('rosterId') && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('roster')}</span>
                <select value={form.rosterId} onChange={(e) => setForm({ ...form, rosterId: e.target.value })} className="field">
                  <option value="">{c('none')}</option>
                  {rosters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {show('status') && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('status')}</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} className="field">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={submit} disabled={pending} className="btn-primary">
              {c('save')}
            </button>
            <button onClick={() => setForm(null)} className="btn-outline">
              {c('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('inGameName')}</th>
              <th className="px-4 py-2 text-start">{t('firstName')}</th>
              <th className="px-4 py-2 text-start">{t('roster')}</th>
              <th className="px-4 py-2 text-start">{t('jersey')}</th>
              <th className="px-4 py-2 text-start">{t('status')}</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2 text-end">{c('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t('empty')}
                </td>
              </tr>
            )}
            {players.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/players/${p.id}`} className="text-accent hover:underline">
                    {p.inGameName}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {p.firstName} {p.lastName}
                </td>
                <td className="px-4 py-2 text-muted">
                  {p.rosterName ? `${p.rosterName}${p.gameTitleName ? ` · ${p.gameTitleName}` : ''}` : c('none')}
                </td>
                <td className="px-4 py-2">{p.jerseyNumber ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-2 text-end">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <button onClick={() => openEdit(p)} className="text-accent hover:underline">
                          {c('edit')}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(p.id)} className="text-red-600 hover:underline">
                          {c('delete')}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}
