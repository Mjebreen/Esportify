'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addRequestComment, updateRequest } from '@/modules/requests/server/actions';
import { REQUEST_STATUSES, PRIORITIES } from '@/modules/requests/schema';
import type { RequestDetail } from '@/modules/requests/server/queries';
import type { OrgMember } from '@/server/org/members';

export function RequestDetailClient({ request, members, canUpdate }: { request: RequestDetail; members: OrgMember[]; canUpdate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(request.status);
  const [priority, setPriority] = useState(request.priority);
  const [assignee, setAssignee] = useState('');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const res = await updateRequest({
        id: request.id,
        status: status as (typeof REQUEST_STATUSES)[number],
        priority: priority as (typeof PRIORITIES)[number],
        assigneeUserId: assignee || undefined,
      });
      setMessage(res.ok ? 'Saved' : res.error);
      if (res.ok) router.refresh();
    });
  }

  function postComment() {
    if (!comment.trim()) return;
    startTransition(async () => {
      const res = await addRequestComment({ requestId: request.id, body: comment });
      if (res.ok) {
        setComment('');
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/requests" className="text-sm text-accent hover:underline">
        ← Requests
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-fg">{request.title}</h1>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-md bg-surface-2 px-2 py-0.5">{request.type.replace('_', ' ')}</span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5">{request.status}</span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5">{request.priority}</span>
        {request.department && <span className="rounded-md bg-surface-2 px-2 py-0.5">{request.department}</span>}
        {request.dueDate && <span className="rounded-md bg-surface-2 px-2 py-0.5">due {request.dueDate}</span>}
      </div>
      {request.description && <p className="mt-4 whitespace-pre-wrap text-sm text-fg">{request.description}</p>}
      <p className="mt-2 text-sm text-muted">
        Raised by {request.requester}
        {request.assignee ? ` · assigned to ${request.assignee}` : ''}
      </p>

      {message && <p className="mt-4 rounded-lg border bg-surface-2 px-3 py-2 text-sm">{message}</p>}

      {canUpdate && (
        <div className="mt-6 grid gap-3 card p-5 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="field">
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="field">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Assign to</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="field">
              <option value="">— keep —</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button onClick={save} disabled={pending} className="btn-primary">
              Save
            </button>
          </div>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold text-fg">Activity</h2>
      <ul className="mt-3 space-y-3">
        {request.comments.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
        {request.comments.map((c) => (
          <li key={c.id} className="rounded-lg border bg-surface p-3 text-sm">
            <div className="text-xs text-muted">
              {c.author} · {c.at}
            </div>
            <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          className="field flex-1"
        />
        <button onClick={postComment} disabled={pending} className="btn-primary">
          Comment
        </button>
      </div>
    </div>
  );
}
