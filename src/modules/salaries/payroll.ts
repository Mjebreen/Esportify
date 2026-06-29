import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';

export interface AdjustmentRow {
  id: string;
  status: string;
  kind: 'WINNING' | 'CUT';
  amount: number;
  currency: string;
  period: string;
  player: string;
  reason: string | null;
  requester: string;
}

export interface PayrollLine {
  kind: 'WINNING' | 'CUT';
  amount: number;
  reason: string | null;
}

export interface PayrollRow {
  playerId: string;
  player: string;
  roster: string;
  currency: string;
  base: number;
  winnings: number;
  cuts: number;
  net: number;
  lines: PayrollLine[];
}

/** Current month as YYYY-MM (used as the default payroll period). */
export function currentPeriod(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function payloadOf(p: unknown): Record<string, unknown> {
  return (p as Record<string, unknown> | null) ?? {};
}

/** Salary adjustments visible to the caller (manager → own rosters; finance/leadership/admin → all). */
export async function listAdjustments(): Promise<AdjustmentRow[]> {
  const principal = await requirePrincipal();
  return withOrgTx(principal.organizationId, async (tx) => {
    const all = await tx.workflowItem.findMany({
      where: { type: 'SALARY_ADJUSTMENT', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { requester: { select: { name: true, email: true } } },
    });
    const seesAll = principal.roleHints.some((r) => ['FINANCE', 'LEADERSHIP', 'SUPER_ADMIN', 'IT'].includes(r));
    const visible = seesAll
      ? all
      : all.filter(
          (i) =>
            i.requesterUserId === principal.userId ||
            (i.subjectRosterId != null && principal.managedRosterIds.includes(i.subjectRosterId)),
        );

    return visible.map((i) => {
      const p = payloadOf(i.payload);
      return {
        id: i.id,
        status: i.status,
        kind: (p.kind as 'WINNING' | 'CUT') ?? 'WINNING',
        amount: Number(p.amount ?? 0),
        currency: String(p.currency ?? 'SAR'),
        period: String(p.period ?? '—'),
        player: String(p.playerName ?? '—'),
        reason: (p.reason as string) ?? null,
        requester: i.requester.name ?? i.requester.email ?? '—',
      };
    });
  });
}

/**
 * Per-player payroll for a period: contract base + approved winnings − approved cuts.
 * Only the parties who pay/oversee salaries (Finance, Leadership, admin) get figures.
 */
export async function payrollForPeriod(period: string): Promise<PayrollRow[]> {
  const principal = await requirePrincipal();
  const canSeeAll = principal.roleHints.some((r) => ['FINANCE', 'LEADERSHIP', 'SUPER_ADMIN', 'IT'].includes(r));
  if (!canSeeAll) return [];

  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  return withOrgTx(principal.organizationId, async (tx) => {
    const players = await tx.player.findMany({
      where: { deletedAt: null },
      select: { id: true, inGameName: true, roster: { select: { name: true } } },
      orderBy: { inGameName: 'asc' },
    });

    // Active contract base per player for this period (latest started, overlapping).
    const contracts = await tx.contract.findMany({
      where: { deletedAt: null, startDate: { lte: periodEnd }, endDate: { gte: periodStart } },
      select: { playerId: true, salaryAmount: true, currency: true, startDate: true },
      orderBy: { startDate: 'desc' },
    });
    const baseByPlayer = new Map<string, { amount: number; currency: string }>();
    for (const c of contracts) {
      if (!baseByPlayer.has(c.playerId)) {
        baseByPlayer.set(c.playerId, { amount: Number(c.salaryAmount ?? 0), currency: c.currency });
      }
    }

    const approved = await tx.workflowItem.findMany({
      where: { type: 'SALARY_ADJUSTMENT', status: 'COMPLETED', subjectPlayerId: { not: null } },
      select: { subjectPlayerId: true, payload: true },
    });
    const adjByPlayer = new Map<string, PayrollLine[]>();
    for (const a of approved) {
      const p = payloadOf(a.payload);
      if (String(p.period) !== period || !a.subjectPlayerId) continue;
      const line: PayrollLine = { kind: (p.kind as 'WINNING' | 'CUT') ?? 'WINNING', amount: Number(p.amount ?? 0), reason: (p.reason as string) ?? null };
      const arr = adjByPlayer.get(a.subjectPlayerId) ?? [];
      arr.push(line);
      adjByPlayer.set(a.subjectPlayerId, arr);
    }

    const rows: PayrollRow[] = players.map((pl) => {
      const base = baseByPlayer.get(pl.id);
      const lines = adjByPlayer.get(pl.id) ?? [];
      const winnings = lines.filter((l) => l.kind === 'WINNING').reduce((s, l) => s + l.amount, 0);
      const cuts = lines.filter((l) => l.kind === 'CUT').reduce((s, l) => s + l.amount, 0);
      const baseAmt = base?.amount ?? 0;
      return {
        playerId: pl.id,
        player: pl.inGameName,
        roster: pl.roster?.name ?? '—',
        currency: base?.currency ?? 'SAR',
        base: baseAmt,
        winnings,
        cuts,
        net: baseAmt + winnings - cuts,
        lines,
      };
    });

    // Only surface players who have a base or any adjustment this period.
    return rows.filter((r) => r.base > 0 || r.lines.length > 0);
  });
}
