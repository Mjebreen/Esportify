import { tenantLoad } from '@/server/action';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  at: string;
}

/** Notifications are inherently personal — always filtered to the current user. */
export async function listNotifications(): Promise<NotificationItem[]> {
  return tenantLoad('notification', 'read', async ({ tx, principal }) => {
    const rows = await tx.notification.findMany({
      where: { userId: principal.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityId,
      read: n.readAt !== null,
      at: n.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    }));
  });
}

export async function unreadNotificationCount(): Promise<number> {
  return tenantLoad('notification', 'read', ({ tx, principal }) =>
    tx.notification.count({ where: { userId: principal.userId, readAt: null } }),
  );
}
