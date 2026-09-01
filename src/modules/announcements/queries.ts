import { tenantLoad } from '@/server/action';

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author: string;
  at: string;
  authorUserId: string;
}

/** Org feed: pinned first, then newest. Everyone with announcement:read sees all. */
export async function listAnnouncements(limit = 50): Promise<AnnouncementItem[]> {
  return tenantLoad('announcement', 'read', async ({ tx }) => {
    const rows = await tx.announcement.findMany({
      where: { deletedAt: null },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: { author: { select: { name: true, email: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      author: a.author.name ?? a.author.email ?? '—',
      at: a.createdAt.toISOString().slice(0, 10),
      authorUserId: a.authorUserId,
    }));
  });
}
