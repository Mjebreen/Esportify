'use server';

import { revalidatePath } from 'next/cache';
import type { WorkflowItem } from '@prisma/client';
import { getCurrentPrincipal } from '@/server/auth/session';
import { withOrgTx, type TxClient } from '@/server/db/tenant';
import { publicErrorMessage, type ActionResult } from '@/server/action';
import type { Principal } from '@/server/authz/types';
import { approveStep, executeStep, rejectStep } from './engine';

async function withItem(
  id: string,
  fn: (tx: TxClient, principal: Principal, item: WorkflowItem) => Promise<void>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const principal = await getCurrentPrincipal();
    if (!principal) return { ok: false, error: 'Not authenticated' };
    await withOrgTx(principal.organizationId, async (tx) => {
      const item = await tx.workflowItem.findFirst({ where: { id, deletedAt: null } });
      if (!item) throw new Error('Not found');
      await fn(tx, principal, item);
    });
    revalidatePath('/approvals');
    revalidatePath('/', 'layout');
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function approveWorkflow(raw: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withItem(raw.id, (tx, p, item) => approveStep(tx, p, item));
}
export async function rejectWorkflow(raw: { id: string; reason?: string }): Promise<ActionResult<{ id: string }>> {
  return withItem(raw.id, (tx, p, item) => rejectStep(tx, p, item, raw.reason));
}
export async function executeWorkflow(raw: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withItem(raw.id, (tx, p, item) => executeStep(tx, p, item));
}
