'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { holdsGrant } from '@/server/authz/gate';

const createSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  pinned: z.boolean().optional(),
});

export const postAnnouncement = tenantAction('announcement', 'create', async (ctx, raw: z.infer<typeof createSchema>) => {
  const input = createSchema.parse(raw);
  // Pinning is a moderation power — reserved for announcement:manage (leadership/admin).
  const canPin = holdsGrant(ctx.principal, 'announcement', 'manage', 'organization');
  const row = await ctx.tx.announcement.create({
    data: {
      organizationId: ctx.principal.organizationId,
      title: input.title,
      body: input.body,
      pinned: canPin ? input.pinned ?? false : false,
      authorUserId: ctx.principal.userId,
    },
  });
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'CREATE', entity: 'Announcement', entityId: row.id, after: { title: row.title, pinned: row.pinned } });
  revalidatePath('/announcements');
  revalidatePath('/dashboard');
  return { id: row.id };
});

export const deleteAnnouncement = tenantAction('announcement', 'read', async (ctx, raw: { id: string }) => {
  const id = z.string().uuid().parse(raw.id);
  // Moderators (announcement:manage) delete anything; an author may delete their own post.
  const isModerator = holdsGrant(ctx.principal, 'announcement', 'manage', 'organization');
  const where = isModerator ? { id, deletedAt: null } : { id, deletedAt: null, authorUserId: ctx.principal.userId };
  const res = await ctx.tx.announcement.updateMany({ where, data: { deletedAt: new Date() } });
  if (res.count !== 1) throw new DomainError('Announcement not found or not yours to delete', 'forbidden');
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'SOFT_DELETE', entity: 'Announcement', entityId: id });
  revalidatePath('/announcements');
  revalidatePath('/dashboard');
  return { id };
});

export const togglePin = tenantAction('announcement', 'manage', async (ctx, raw: { id: string; pinned: boolean }) => {
  const id = z.string().uuid().parse(raw.id);
  const res = await ctx.tx.announcement.updateMany({ where: { id, deletedAt: null }, data: { pinned: !!raw.pinned } });
  if (res.count !== 1) throw new DomainError('Announcement not found', 'not_found');
  await writeAudit(ctx.tx, { actorUserId: ctx.principal.userId, action: 'UPDATE', entity: 'Announcement', entityId: id, after: { pinned: !!raw.pinned } });
  revalidatePath('/announcements');
  revalidatePath('/dashboard');
  return { id };
});
