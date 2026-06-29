'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { markAllNotificationsRead, markNotificationRead } from '@/modules/notifications/server/actions';
import type { NotificationItem } from '@/modules/notifications/server/queries';

/** Deep-link a notification to the entity it's about. */
function targetHref(n: NotificationItem): string | null {
  if (n.entityType === 'Request' && n.entityId) return `/requests/${n.entityId}`;
  if (n.entityType === 'WorkflowItem') return '/approvals';
  if (n.entityType === 'Invoice') return '/invoices';
  if (n.entityType === 'Task') return '/tasks';
  return null;
}

export function NotificationsClient({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });

  function open(n: NotificationItem) {
    const href = targetHref(n);
    if (!href) return;
    startTransition(async () => {
      if (!n.read) await markNotificationRead({ id: n.id });
      router.push(href);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Notifications</h1>
        <button onClick={() => act(() => markAllNotificationsRead({}))} disabled={pending} className="text-sm text-accent hover:underline">
          Mark all read
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {notifications.length === 0 && <li className="text-sm text-muted">{"You're all caught up."}</li>}
        {notifications.map((n) => {
          const href = targetHref(n);
          return (
            <li key={n.id} className={`rounded-lg border p-3 text-sm ${n.read ? 'bg-surface' : 'bg-accent/5'}`}>
              <div className="flex items-center justify-between gap-2">
                {href ? (
                  <button onClick={() => open(n)} disabled={pending} className="text-start font-medium text-fg hover:text-accent hover:underline">
                    {n.title}
                  </button>
                ) : (
                  <span className="font-medium text-fg">{n.title}</span>
                )}
                {!n.read && (
                  <button onClick={() => act(() => markNotificationRead({ id: n.id }))} disabled={pending} className="shrink-0 text-xs text-accent hover:underline">
                    Mark read
                  </button>
                )}
              </div>
              {n.body && <div className="mt-1 text-muted">{n.body}</div>}
              <div className="mt-1 text-xs text-muted">{n.at}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
