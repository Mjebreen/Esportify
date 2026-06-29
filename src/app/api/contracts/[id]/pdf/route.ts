import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';
import { getObject } from '@/server/storage/media';

/**
 * Serve a contract's signed PDF, gated by contract-read scope (manager→roster,
 * leadership/admin→org). Bytes stream through the app — never a public URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contract = await tenantLoad('contract', 'read', ({ tx, where }) =>
    tx.contract.findFirst({
      where: { id, deletedAt: null, ...(where as Prisma.ContractWhereInput) },
      select: { pdfKey: true, pdfName: true },
    }),
  ).catch(() => null);

  if (!contract || !contract.pdfKey) return new NextResponse('Not found', { status: 404 });

  const bytes = await getObject(contract.pdfKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${(contract.pdfName ?? 'contract.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
