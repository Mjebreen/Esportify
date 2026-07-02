'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Badge, statusTone } from './Badge';

export type CrudAction = (input: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hideOnEdit?: boolean;
}

// Serializable column descriptors — NO functions (they can't cross the server→client
// boundary). CrudManager interprets `kind` to format the cell.
export interface ColumnDef {
  key: string;
  label: string;
  kind?: 'text' | 'date' | 'datetime' | 'money' | 'percent' | 'rel' | 'status';
  currencyKey?: string; // for kind 'money' (default 'currency')
  relField?: string; // for kind 'rel' (nested object field, default 'name')
  fallback?: string; // shown when the value is null/undefined (default '—')
}

/** Format an ISO instant in the VIEWER's local wall time for datetime-local inputs
 * and cells. Slicing the ISO string would show UTC and drift on every edit round-trip. */
function toLocalParts(v: unknown): string {
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderCell(col: ColumnDef, row: Record<string, unknown>): React.ReactNode {
  const v = row[col.key];
  const dash = col.fallback ?? '—';
  switch (col.kind) {
    case 'date':
      return v ? String(v).slice(0, 10) : dash;
    case 'datetime':
      return v ? toLocalParts(v).replace('T', ' ') : dash;
    case 'money':
      return v != null && v !== ''
        ? `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${row[col.currencyKey ?? 'currency'] ?? ''}`.trim()
        : dash;
    case 'percent':
      return v != null && v !== '' ? `${v}%` : dash;
    case 'rel':
      return v && typeof v === 'object' ? String((v as Record<string, unknown>)[col.relField ?? 'name'] ?? dash) : dash;
    case 'status':
      return v ? <Badge tone={statusTone(String(v))}>{String(v)}</Badge> : dash;
    default:
      return v == null || v === '' ? dash : String(v);
  }
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
  /** If set, each row gets a "View" link to `${detailBase}/${row.id}`. */
  detailBase?: string;
}

function toFieldValue(raw: unknown, type: FieldDef['type']): string {
  if (raw === null || raw === undefined) return '';
  if (type === 'date' && typeof raw === 'string') return raw.slice(0, 10);
  // Pre-fill datetime-local in the viewer's local time so an untouched Save
  // round-trips the same instant instead of shifting by the UTC offset.
  if (type === 'datetime' && typeof raw === 'string') return toLocalParts(raw);
  return String(raw);
}

export function CrudManager(props: Props) {
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

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
      } else if (f.type === 'datetime') {
        // datetime-local strings are TZ-less; parse in the USER's timezone and send an
        // unambiguous instant so the server's TZ never shifts the value.
        payload[f.name] = new Date(v).toISOString();
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
        setMessage({ text: editingId ? t('saved') : t('created'), tone: 'success' });
        router.refresh();
      } else {
        setMessage({ text: res.error ?? 'Error', tone: 'error' });
      }
    });
  }

  function remove(id: string) {
    if (!props.deleteAction || !confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      const res = await props.deleteAction!({ id });
      setMessage(res.ok ? { text: t('deleted'), tone: 'success' } : { text: res.error ?? 'Error', tone: 'error' });
      if (res.ok) router.refresh();
    });
  }

  const showActions = props.canUpdate || props.canDelete || !!props.detailBase;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{props.title}</h1>
          {props.subtitle && <p className="mt-0.5 text-sm text-muted">{props.subtitle}</p>}
        </div>
        {props.canCreate && props.createAction && (
          <button onClick={openNew} className="btn-primary">
            <Plus className="h-4 w-4" />
            {props.newLabel}
          </button>
        )}
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}

      {form && (
        <div className="card mt-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {props.fields.map((f) =>
              editingId && f.hideOnEdit ? null : (
                <label key={f.name} className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{f.label}</span>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="field min-h-20"
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="field"
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
                      className="field"
                    />
                  )}
                </label>
              ),
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={submit} disabled={pending} className="btn-primary">
              {t('save')}
            </button>
            <button onClick={() => setForm(null)} className="btn-outline">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {props.columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5 text-start font-medium">
                  {c.label}
                </th>
              ))}
              {showActions && <th className="px-4 py-2.5 text-end font-medium">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 && (
              <tr>
                <td colSpan={props.columns.length + 1} className="px-4 py-12 text-center text-muted">
                  {props.emptyLabel}
                </td>
              </tr>
            )}
            {props.rows.map((row) => (
              <tr key={String(row.id)} className="border-b transition-colors last:border-0 hover:bg-surface-2/60">
                {props.columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-fg/90">
                    {renderCell(c, row)}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-2.5 text-end">
                    <div className="flex justify-end gap-3 text-sm">
                      {props.detailBase && (
                        <Link href={`${props.detailBase}/${String(row.id)}`} className="font-medium text-accent hover:underline">
                          {t('view')}
                        </Link>
                      )}
                      {props.canUpdate && props.updateAction && (
                        <button onClick={() => openEdit(row)} className="font-medium text-muted hover:text-fg">
                          {t('edit')}
                        </button>
                      )}
                      {props.canDelete && props.deleteAction && (
                        <button onClick={() => remove(String(row.id))} className="font-medium text-red-500 hover:text-red-600">
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
