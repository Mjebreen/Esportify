'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { createManager, deleteManager, updateManager } from '@/modules/managers/server/actions';
import type { ManagerListItem } from '@/modules/managers/server/queries';

interface Props {
  managers: ManagerListItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

type FormState = { id?: string; firstName: string; lastName: string; email: string };
const EMPTY: FormState = { firstName: '', lastName: '', email: '' };

export function ManagersClient({ managers, canCreate, canUpdate, canDelete }: Props) {
  const t = useTranslations('managers');
  const c = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    if (!form) return;
    startTransition(async () => {
      const payload = { firstName: form.firstName, lastName: form.lastName, email: form.email || null };
      const res = form.id ? await updateManager({ id: form.id, ...payload }) : await createManager(payload);
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
      const res = await deleteManager({ id });
      setMessage(res.ok ? t('deleted') : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <button onClick={() => { setMessage(null); setForm({ ...EMPTY }); }} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t('new')}
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-md border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {form && (
        <div className="mt-4 card p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('firstName')} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
            <Field label={t('lastName')} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
            <Field label={t('email')} value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
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
              <th className="px-4 py-2 text-start">{t('firstName')}</th>
              <th className="px-4 py-2 text-start">{t('email')}</th>
              <th className="px-4 py-2 text-start">{t('rosters')}</th>
              <th className="px-4 py-2 text-start">{t('status')}</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2 text-end">{c('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t('empty')}
                </td>
              </tr>
            )}
            {managers.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">
                  {m.firstName} {m.lastName}
                </td>
                <td className="px-4 py-2 text-muted">{m.email ?? '—'}</td>
                <td className="px-4 py-2">{m.rosterCount}</td>
                <td className="px-4 py-2">
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-2 text-end">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <button
                          onClick={() => { setMessage(null); setForm({ id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email ?? '' }); }}
                          className="text-accent hover:underline"
                        >
                          {c('edit')}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(m.id)} className="text-red-600 hover:underline">
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
