import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';

export interface PhotoCard {
  id: string;
  status: string;
  kind: string;
  event: string | null;
  roster: string;
  requester: string;
  deadline: string | null;
  notes: string | null;
}

export async function listPhotoRequests(): Promise<PhotoCard[]> {
  const principal = await requirePrincipal();
  return withOrgTx(principal.organizationId, async (tx) => {
    const seesAll = principal.roleHints.some((r) => ['MARCOM', 'LEADERSHIP', 'SUPER_ADMIN', 'IT'].includes(r));
    // Visibility enforced in the WHERE — non-privileged callers never pull other
    // requesters' rows (or payloads) out of the database at all.
    const visible = await tx.workflowItem.findMany({
      where: { type: 'PHOTO', deletedAt: null, ...(seesAll ? {} : { requesterUserId: principal.userId }) },
      orderBy: { createdAt: 'desc' },
      include: { requester: { select: { name: true, email: true } } },
    });

    return visible.map((i) => {
      const p = (i.payload as Record<string, unknown> | null) ?? {};
      return {
        id: i.id,
        status: i.status,
        kind: String(p.kind ?? 'PHOTOSHOOT').replace('_', ' '),
        event: (p.event as string) ?? null,
        roster: String(p.rosterName ?? '—'),
        requester: i.requester.name ?? i.requester.email ?? '—',
        deadline: typeof p.deadline === 'string' ? p.deadline.slice(0, 10) : null,
        notes: (p.notes as string) ?? null,
      };
    });
  });
}
