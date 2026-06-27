'use server';

import { revalidatePath } from 'next/cache';
import { tenantAction } from '@/server/action';

export const markNotificationRead = tenantAction('notification', 'update', async (ctx, raw: { id: string }) => {
  await ctx.tx.notification.updateMany({
    where: { id: raw.id, userId: ctx.principal.userId },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { id: raw.id };
});

export const markAllNotificationsRead = tenantAction('notification', 'update', async (ctx, _raw: Record<string, never>) => {
  await ctx.tx.notification.updateMany({
    where: { userId: ctx.principal.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { ok: true };
});
