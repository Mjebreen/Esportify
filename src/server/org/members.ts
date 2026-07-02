import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx, type TxClient } from '@/server/db/tenant';
import { DomainError } from '@/server/action';

export interface OrgMember {
  userId: string;
  name: string;
}

/**
 * FK guard for assignee writes: the target user must hold an ACTIVE membership in
 * the current org (RLS pins the membership scan to the active org). Prevents
 * assigning tasks/requests to arbitrary or ex-member user ids.
 */
export async function assertActiveMember(tx: TxClient, userId: string): Promise<void> {
  const m = await tx.membership.findFirst({ where: { userId, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
  if (!m) throw new DomainError('Assignee is not an active member of this organization', 'invalid_assignee');
}

/**
 * Active members of the current org (display names) for assignee pickers. Any
 * authenticated member may see colleague names; RLS scopes to the active org.
 */
export async function listOrgMembers(): Promise<OrgMember[]> {
  const principal = await requirePrincipal();
  return withOrgTx(principal.organizationId, async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { userId: true },
      distinct: ['userId'],
    });
    const ids = memberships.map((m) => m.userId);
    if (ids.length === 0) return [];
    const users = await tx.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({ userId: u.id, name: u.name ?? u.email ?? '—' }));
  });
}
