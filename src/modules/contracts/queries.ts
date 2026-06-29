import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface ContractDetail {
  id: string;
  player: string;
  status: string;
  startDate: string;
  endDate: string;
  salaryAmount: string | null;
  currency: string;
  buyout: string | null;
  prizeSplitPct: string | null;
  notes: string | null;
  pdfName: string | null;
  clauses: Array<{ id: string; title: string; body: string }>;
}

export async function getContractDetail(id: string): Promise<ContractDetail | null> {
  return tenantLoad('contract', 'read', async ({ tx, where }) => {
    const c = await tx.contract.findFirst({
      where: { id, deletedAt: null, ...(where as Prisma.ContractWhereInput) },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        salaryAmount: true,
        currency: true,
        buyout: true,
        prizeSplitPct: true,
        notes: true,
        pdfName: true,
        player: { select: { inGameName: true } },
        clauses: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, body: true } },
      },
    });
    if (!c) return null;
    return {
      id: c.id,
      player: c.player.inGameName,
      status: c.status,
      startDate: c.startDate.toISOString().slice(0, 10),
      endDate: c.endDate.toISOString().slice(0, 10),
      salaryAmount: c.salaryAmount ? c.salaryAmount.toString() : null,
      currency: c.currency,
      buyout: c.buyout ? c.buyout.toString() : null,
      prizeSplitPct: c.prizeSplitPct ? c.prizeSplitPct.toString() : null,
      notes: c.notes,
      pdfName: c.pdfName,
      clauses: c.clauses,
    };
  });
}
