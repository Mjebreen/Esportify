'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Megaphone, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { deleteAnnouncement, postAnnouncement, togglePin } from '@/modules/announcements/actions';
import type { AnnouncementItem } from '@/modules/announcements/queries';

interface Props {
  items: AnnouncementItem[];
  canPost: boolean;
  canModerate: boolean;
  meUserId: string;
}

export function AnnouncementsClient({ items, canPost, canModerate, meUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? ok ?? null : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });

  function post() {
    if (!title.trim() || !body.trim()) return;
    run(
      () =>
        postAnnouncement({ title, body, pinned }).then((r) => {
          if (r.ok) {
            setTitle('');
            setBody('');
            setPinned(false);
            setOpen(false);
          }
          return r;
        }),
      'Announcement posted',
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Announcements</h1>
          <p className="mt-0.5 text-sm text-muted">Org-wide news — pinned posts stay on top</p>
        </div>
        {canPost && (
          <button onClick={() => setOpen(!open)} className="btn-primary">
            <Plus className="h-4 w-4" /> New post
          </button>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border bg-surface px-3 py-2 text-sm text-fg">{message}</p>}

      {open && (
        <div className="card mt-4 grid gap-3 p-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="field" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What does the org need to know?" className="field min-h-24" />
          <div className="flex items-center justify-between">
            {canModerate ? (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4" />
                Pin to top
              </label>
            ) : (
              <span />
            )}
            <button onClick={post} disabled={pending || !title.trim() || !body.trim()} className="btn-primary">
              Post
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items.length === 0 && <p className="text-sm text-muted">Nothing announced yet.</p>}
        {items.map((a) => (
          <div key={a.id} className={`card p-4 ${a.pinned ? 'border-accent/40' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {a.pinned ? <Pin className="h-4 w-4 shrink-0 text-accent" /> : <Megaphone className="h-4 w-4 shrink-0 text-muted" />}
                <span className="font-medium text-fg">{a.title}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                {canModerate && (
                  <button
                    onClick={() => run(() => togglePin({ id: a.id, pinned: !a.pinned }), a.pinned ? 'Unpinned' : 'Pinned')}
                    disabled={pending}
                    className="text-muted hover:text-fg"
                    title={a.pinned ? 'Unpin' : 'Pin'}
                  >
                    {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                )}
                {(canModerate || a.authorUserId === meUserId) && (
                  <button
                    onClick={() => confirm('Delete this announcement?') && run(() => deleteAnnouncement({ id: a.id }), 'Deleted')}
                    disabled={pending}
                    className="text-red-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-fg/90">{a.body}</p>
            <div className="mt-2 text-xs text-muted">
              {a.author} · {a.at}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
