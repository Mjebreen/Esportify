'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createRequest } from '@/modules/requests/server/actions';
import { REQUEST_TYPES, PRIORITIES } from '@/modules/requests/schema';
import type { RequestListItem } from '@/modules/requests/server/queries';

const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-zinc-200 text-zinc-600',
};

export function RequestsClient({
  requests,
  departments,
  canCreate,
}: {
  requests: RequestListItem[];
  departments: Array<{ id: string; name: string }>;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'GENERAL', title: '', description: '', priority: 'MEDIUM', targetDepartmentId: '', dueDate: '' });
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const res = await createRequest({
        type: form.type as (typeof REQUEST_TYPES)[number],
        title: form.title,
        description: form.description || null,
        priority: form.priority as (typeof PRIORITIES)[number],
        targetDepartmentId: form.targetDepartmentId || null,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
      });
      if (res.ok) {
        setOpen(false);
        setForm({ type: 'GENERAL', title: '', description: '', priority: 'MEDIUM', targetDepartmentId: '', dueDate: '' });
        setMessage('Request created');
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">Requests</h1>
          <p className="text-sm text-muted">Raise & route requests across departments</p>
        </div>
        {canCreate && (
          <button onClick={() => setOpen(!open)} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white">
            New request
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-md border bg-surface px-3 py-2 text-sm">{message}</p>}

      {open && (
        <div className="mt-4 grid gap-3 rounded-xl border bg-surface p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-md border bg-surface px-3 py-2">
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Route to department</span>
            <select value={form.targetDepartmentId} onChange={(e) => setForm({ ...form, targetDepartmentId: e.target.value })} className="rounded-md border bg-surface px-3 py-2">
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border bg-surface px-3 py-2" />
          </label>
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20 rounded-md border bg-surface px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-md border bg-surface px-3 py-2">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Due date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded-md border bg-surface px-3 py-2" />
          </label>
          <div className="col-span-full flex gap-2">
            <button onClick={submit} disabled={pending || !form.title} className="rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">
              Create
            </button>
            <button onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm hover:bg-bg">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b bg-bg text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 text-start">Title</th>
              <th className="px-4 py-2 text-start">Type</th>
              <th className="px-4 py-2 text-start">Status</th>
              <th className="px-4 py-2 text-start">Priority</th>
              <th className="px-4 py-2 text-start">Dept</th>
              <th className="px-4 py-2 text-start">Assignee</th>
              <th className="px-4 py-2 text-start">Due</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No requests visible to you yet.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/requests/${r.id}`} className="font-medium text-accent hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted">{r.type.replace('_', ' ')}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[r.status] ?? ''}`}>{r.status}</span>
                </td>
                <td className="px-4 py-2">{r.priority}</td>
                <td className="px-4 py-2 text-muted">{r.department ?? '—'}</td>
                <td className="px-4 py-2 text-muted">{r.assignee ?? '—'}</td>
                <td className="px-4 py-2 text-muted">{r.dueDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
