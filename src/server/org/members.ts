import { requirePrincipal } from '@/server/auth/session';
import { withOrgTx } from '@/server/db/tenant';

export interface OrgMember {
  userId: string;
  name: string;
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
