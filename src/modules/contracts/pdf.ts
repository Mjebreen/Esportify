'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError, tenantAction } from '@/server/action';
import { writeAudit } from '@/server/audit/audit';
import { buildMediaKey, putObject } from '@/server/storage/media';

const MAX_BYTES = 10_000_000; // 10MB

const uploadSchema = z.object({
  contractId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  dataBase64: z.string().min(1),
});

/**
 * Attach the signed contract PDF. Authorized as a contract UPDATE (manager→roster,
 * leadership/admin→org), so only those who manage the contract can attach its PDF.
 * The bytes are served back through the contract-read gate, not the public media route.
 */
export const uploadContractPdf = tenantAction('contract', 'update', async (ctx, raw: z.infer<typeof uploadSchema>) => {
  const input = uploadSchema.parse(raw);

  // Reject oversized payloads from the base64 LENGTH before allocating the decoded
  // buffer (base64 is ~4/3 of the raw size), so a huge string can't balloon memory.
  if (input.dataBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 4) {
    throw new DomainError('PDF too large (max 10MB)', 'too_large');
  }

  // The contract must be within the caller's scope.
  const contract = await ctx.tx.contract.findFirst({
    where: { id: input.contractId, deletedAt: null, ...(ctx.where as Prisma.ContractWhereInput) },
    select: { id: true },
  });
  if (!contract) throw new DomainError('Contract not found', 'not_found');

  const buffer = Buffer.from(input.dataBase64, 'base64');
  if (buffer.length === 0) throw new DomainError('Empty file', 'invalid');
  if (buffer.length > MAX_BYTES) throw new DomainError('PDF too large (max 10MB)', 'too_large');
  // Validate it's actually a PDF (magic bytes %PDF-).
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new DomainError('File must be a PDF', 'invalid');

  const safeName = input.fileName.endsWith('.pdf') ? input.fileName : `${input.fileName}.pdf`;
  const key = buildMediaKey(ctx.principal.organizationId, 'CONTRACT', input.contractId, `${Date.now()}-${safeName}`);
  await putObject(key, buffer, 'application/pdf');

  // Scoped write (convention): the scope predicate is enforced AT WRITE TIME, so the
  // row can't drift out of the caller's scope between the check and the update.
  const res = await ctx.tx.contract.updateMany({
    where: { id: input.contractId, deletedAt: null, ...(ctx.where as Prisma.ContractWhereInput) },
    data: { pdfKey: key, pdfName: safeName },
  });
  if (res.count !== 1) throw new DomainError('Contract not found', 'not_found');

  await writeAudit(ctx.tx, {
    actorUserId: ctx.principal.userId,
    action: 'UPDATE',
    entity: 'Contract',
    entityId: input.contractId,
    after: { pdfName: safeName },
  });

  revalidatePath(`/contracts/${input.contractId}`);
  return { id: input.contractId };
});
