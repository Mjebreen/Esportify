'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Badge, statusTone } from '@/components/Badge';
import { createRequest } from '@/modules/requests/server/actions';
import { REQUEST_TYPES, PRIORITIES } from '@/modules/requests/schema';
import type { RequestListItem } from '@/modules/requests/server/queries';

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
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New request
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface-2 px-3 py-2 text-sm">{message}</p>}

      {open && (
        <div className="mt-4 grid gap-3 card p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="field">
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Route to department</span>
            <select value={form.targetDepartmentId} onChange={(e) => setForm({ ...form, targetDepartmentId: e.target.value })} className="field">
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
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field" />
          </label>
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field min-h-20" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="field">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Due date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="field" />
          </label>
          <div className="col-span-full flex gap-2">
            <button onClick={submit} disabled={pending || !form.title} className="btn-primary">
              Create
            </button>
            <button onClick={() => setOpen(false)} className="btn-outline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-muted">
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
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
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
