'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { tenantAction } from '@/server/action';

export const markNotificationRead = tenantAction('notification', 'update', async (ctx, raw: { id: string }) => {
  // ctx.where resolves to { userId: principal.userId } — the gate's own scope predicate.
  await ctx.tx.notification.updateMany({
    where: { id: raw.id, ...(ctx.where as Prisma.NotificationWhereInput) },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { id: raw.id };
});

export const markAllNotificationsRead = tenantAction('notification', 'update', async (ctx, _raw: Record<string, never>) => {
  await ctx.tx.notification.updateMany({
    where: { readAt: null, ...(ctx.where as Prisma.NotificationWhereInput) },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { ok: true };
});
