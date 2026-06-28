'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createTask, updateTask } from '@/modules/tasks/server/actions';
import { TASK_STATUSES, PRIORITIES } from '@/modules/tasks/schema';
import type { TaskListItem } from '@/modules/tasks/server/queries';
import type { OrgMember } from '@/server/org/members';

const COLUMNS: Array<{ key: (typeof TASK_STATUSES)[number]; label: string }> = [
  { key: 'TODO', label: 'To do' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'DONE', label: 'Done' },
];

export function TasksClient({
  tasks,
  members,
  canCreate,
  canUpdate,
}: {
  tasks: TaskListItem[];
  members: OrgMember[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigneeUserId: '', priority: 'MEDIUM', dueDate: '' });
  const [message, setMessage] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      const res = await createTask({
        title: form.title,
        description: form.description || null,
        assigneeUserId: form.assigneeUserId || null,
        priority: form.priority as (typeof PRIORITIES)[number],
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
      });
      if (res.ok) {
        setOpen(false);
        setForm({ title: '', description: '', assigneeUserId: '', priority: 'MEDIUM', dueDate: '' });
        setMessage('Task created');
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });
  }

  function move(id: string, status: (typeof TASK_STATUSES)[number]) {
    startTransition(async () => {
      const res = await updateTask({ id, status });
      setMessage(res.ok ? null : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">Tasks</h1>
          <p className="text-sm text-muted">Assignments & tracking</p>
        </div>
        {canCreate && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            New task
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface-2 px-3 py-2 text-sm">{message}</p>}

      {open && (
        <div className="mt-4 grid gap-3 card p-5 sm:grid-cols-2">
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field" />
          </label>
          <label className="col-span-full flex flex-col gap-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field min-h-16" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Assignee</span>
            <select value={form.assigneeUserId} onChange={(e) => setForm({ ...form, assigneeUserId: e.target.value })} className="field">
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
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
          <div className="col-span-full">
            <button onClick={create} disabled={pending || !form.title} className="btn-primary">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-xl border bg-bg p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
                <span>{col.label}</span>
                <span>{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((t) => (
                  <div key={t.id} className="rounded-lg border bg-surface p-3 text-sm">
                    <div className="font-medium text-fg">{t.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {t.assignee ?? 'Unassigned'} · {t.priority}
                      {t.dueDate ? ` · due ${t.dueDate}` : ''}
                    </div>
                    {canUpdate && (
                      <select
                        value={t.status}
                        onChange={(e) => move(t.id, e.target.value as (typeof TASK_STATUSES)[number])}
                        className="mt-2 w-full rounded border bg-bg px-2 py-1 text-xs"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
