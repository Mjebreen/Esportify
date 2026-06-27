import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface ManagerListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  rosterCount: number;
}

/** List managers the caller may read (org-scoped for admins/leadership; own for a manager). */
export async function listManagers(): Promise<ManagerListItem[]> {
  return tenantLoad('manager', 'read', async ({ tx, where }) => {
    const managers = await tx.manager.findMany({
      where: { deletedAt: null, ...(where as Prisma.ManagerWhereInput) },
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        _count: { select: { rosters: { where: { deletedAt: null } } } },
      },
    });
    return managers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      status: m.status,
      rosterCount: m._count.rosters,
    }));
  });
}
