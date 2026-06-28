'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { buildMediaKey, putObject } from '@/server/storage/media';

const MAX_BYTES = 2_000_000;

const uploadSchema = z.object({
  playerId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().regex(/^image\/(png|jpe?g|webp|gif)$/, 'Only PNG/JPEG/WebP/GIF images'),
  dataBase64: z.string().min(1),
  visibility: z.enum(['PRIVATE', 'ROSTER', 'ORG_INTERNAL', 'RESTRICTED']).optional(),
});

export const uploadPlayerMedia = tenantAction('mediaAsset', 'create', async (ctx, raw: z.infer<typeof uploadSchema>) => {
  const input = uploadSchema.parse(raw);

  // The target player must be within the uploader's scope (manager -> their roster).
  const player = await ctx.tx.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { id: true, rosterId: true },
  });
  if (!player) throw new DomainError('Player not found', 'not_found');
  if (ctx.scope === 'roster' && (!player.rosterId || !ctx.principal.managedRosterIds.includes(player.rosterId))) {
    throw new DomainError('Player not in your roster', 'forbidden_scope');
  }

  const buffer = Buffer.from(input.dataBase64, 'base64');
  if (buffer.length === 0) throw new DomainError('Empty file', 'invalid');
  if (buffer.length > MAX_BYTES) throw new DomainError('Image too large (max 2MB)', 'too_large');

  const key = buildMediaKey(ctx.principal.organizationId, 'PLAYER', input.playerId, `${Date.now()}-${input.fileName}`);
  await putObject(key, buffer, input.contentType);

  const asset = await ctx.tx.mediaAsset.create({
    data: {
      organizationId: ctx.principal.organizationId,
      s3Key: key,
      contentType: input.contentType,
      sizeBytes: BigInt(buffer.length),
      status: 'READY',
      ownerType: 'PLAYER',
      ownerId: input.playerId,
      rosterId: player.rosterId,
      visibility: input.visibility ?? 'ROSTER',
      uploadedById: ctx.principal.userId,
    },
  });

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'CREATE',
    entity: 'MediaAsset',
    entityId: asset.id,
    subjectType: 'PLAYER',
    subjectId: input.playerId,
    after: { ownerType: 'PLAYER', ownerId: input.playerId, contentType: input.contentType },
  });

  revalidatePath(`/players/${input.playerId}`);
  return { id: asset.id };
});

export const deleteMedia = tenantAction('mediaAsset', 'delete', async (ctx, raw: { id: string; playerId: string }) => {
  const res = await ctx.tx.mediaAsset.updateMany({
    where: { id: raw.id, deletedAt: null, ...(ctx.where as Prisma.MediaAssetWhereInput) },
    data: { deletedAt: new Date() },
  });
  if (res.count !== 1) throw new DomainError('Media not found', 'not_found');
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'SOFT_DELETE', entity: 'MediaAsset', entityId: raw.id });
  revalidatePath(`/players/${raw.playerId}`);
  return { id: raw.id };
});
