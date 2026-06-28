import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface InvoiceRow {
  id: string;
  number: string;
  player: string;
  amount: string;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  notes: string | null;
}

export async function listInvoicesWorkflow(): Promise<InvoiceRow[]> {
  return tenantLoad('invoice', 'read', async ({ tx, where }) => {
    const rows = await tx.invoice.findMany({
      where: { deletedAt: null, ...(where as Prisma.InvoiceWhereInput) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        amount: true,
        currency: true,
        status: true,
        issuedAt: true,
        dueAt: true,
        notes: true,
        player: { select: { inGameName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      player: r.player.inGameName,
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
      issuedAt: r.issuedAt.toISOString().slice(0, 10),
      dueAt: r.dueAt ? r.dueAt.toISOString().slice(0, 10) : null,
      notes: r.notes,
    }));
  });
}
