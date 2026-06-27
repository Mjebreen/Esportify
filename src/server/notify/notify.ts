import type { NotificationType } from '@prisma/client';
import { requireActiveOrgId, type TxClient } from '../db/tenant';

export interface NotifyInput {
  userId: string | null | undefined;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/** Create an in-app notification. Runs inside the action's org-bound tx (RLS pins org).
 * Email delivery would hang off the same call in production. */
export async function notify(tx: TxClient, input: NotifyInput): Promise<void> {
  if (!input.userId) return;
  await tx.notification.create({
    data: {
      organizationId: requireActiveOrgId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}
