'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

export type CrudAction = (input: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hideOnEdit?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

interface Props {
  title: string;
  subtitle?: string;
  newLabel: string;
  emptyLabel: string;
  rows: Array<Record<string, unknown>>;
  columns: ColumnDef[];
  fields: FieldDef[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  createAction?: CrudAction;
  updateAction?: CrudAction;
  deleteAction?: CrudAction;
}

function toFieldValue(raw: unknown, type: FieldDef['type']): string {
  if (raw === null || raw === undefined) return '';
  if (type === 'date' && typeof raw === 'string') return raw.slice(0, 10);
  if (type === 'datetime' && typeof raw === 'string') return raw.slice(0, 16);
  return String(raw);
}

export function CrudManager(props: Props) {
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function openNew() {
    setMessage(null);
    setEditingId(null);
    setForm(Object.fromEntries(props.fields.map((f) => [f.name, ''])));
  }

  function openEdit(row: Record<string, unknown>) {
    setMessage(null);
    setEditingId(String(row.id));
    setForm(Object.fromEntries(props.fields.map((f) => [f.name, toFieldValue(row[f.name], f.type)])));
  }

  function submit() {
    if (!form) return;
    const payload: Record<string, unknown> = {};
    for (const f of props.fields) {
      if (editingId && f.hideOnEdit) continue;
      const v = form[f.name] ?? '';
      if (v === '') {
        payload[f.name] = f.required ? '' : null;
      } else if (f.type === 'number') {
        payload[f.name] = Number(v);
      } else {
        payload[f.name] = v;
      }
    }
    startTransition(async () => {
      const action = editingId ? props.updateAction : props.createAction;
      if (!action) return;
      if (editingId) payload.id = editingId;
      const res = await action(payload);
      if (res.ok) {
        setForm(null);
        setEditingId(null);
        setMessage(editingId ? t('save') : t('create'));
        router.refresh();
      } else {
        setMessage(res.error ?? 'Error');
      }
    });
  }

  function remove(id: string) {
    if (!props.deleteAction || !confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      const res = await props.deleteAction!({ id });
      setMessage(res.ok ? t('delete') : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });
  }

  const showActions = props.canUpdate || props.canDelete;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">{props.title}</h1>
          {props.subtitle && <p className="text-sm text-muted">{props.subtitle}</p>}
        </div>
        {props.canCreate && props.createAction && (
          <button onClick={openNew} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
            {props.newLabel}
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-md border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {form && (
        <div className="mt-4 rounded-xl border bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {props.fields.map((f) =>
              editingId && f.hideOnEdit ? null : (
                <label key={f.name} className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{f.label}</span>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="min-h-20 rounded-md border bg-surface px-3 py-2"
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="rounded-md border bg-surface px-3 py-2"
                    >
                      <option value="">{t('none')}</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'datetime' ? 'datetime-local' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="rounded-md border bg-surface px-3 py-2"
                    />
                  )}
                </label>
              ),
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={submit} disabled={pending} className="rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">
              {t('save')}
            </button>
            <button onClick={() => setForm(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-bg">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b bg-bg text-xs uppercase tracking-wide text-muted">
            <tr>
              {props.columns.map((c) => (
                <th key={c.key} className="px-4 py-2 text-start">
                  {c.label}
                </th>
              ))}
              {showActions && <th className="px-4 py-2 text-end">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 && (
              <tr>
                <td colSpan={props.columns.length + 1} className="px-4 py-8 text-center text-muted">
                  {props.emptyLabel}
                </td>
              </tr>
            )}
            {props.rows.map((row) => (
              <tr key={String(row.id)} className="border-b last:border-0">
                {props.columns.map((c) => (
                  <td key={c.key} className="px-4 py-2">
                    {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-2 text-end">
                    <div className="flex justify-end gap-2">
                      {props.canUpdate && props.updateAction && (
                        <button onClick={() => openEdit(row)} className="text-accent hover:underline">
                          {t('edit')}
                        </button>
                      )}
                      {props.canDelete && props.deleteAction && (
                        <button onClick={() => remove(String(row.id))} className="text-red-600 hover:underline">
                          {t('delete')}
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
