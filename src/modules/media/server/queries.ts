import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface MediaItem {
  id: string;
  contentType: string;
  visibility: string;
}

/** Photos for a player, scope-filtered (manager: their roster; player: their own). */
export async function listPlayerMedia(playerId: string): Promise<MediaItem[]> {
  return tenantLoad('mediaAsset', 'read', async ({ tx, where }) => {
    const rows = await tx.mediaAsset.findMany({
      where: { deletedAt: null, status: 'READY', ownerType: 'PLAYER', ownerId: playerId, ...(where as Prisma.MediaAssetWhereInput) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, contentType: true, visibility: true },
    });
    return rows.map((r) => ({ id: r.id, contentType: r.contentType, visibility: r.visibility }));
  });
}
