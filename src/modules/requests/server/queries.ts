import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';
import { holdsGrant } from '@/server/authz/gate';
import type { Principal } from '@/server/authz/types';

/**
 * Request visibility is a UNION: your own (requester/assignee) + your department's
 * routed requests (if a dept handler) + everything (if org-level). The single-scope
 * gate can't express the union, so we build it explicitly from the principal's grants.
 */
export function requestVisibilityWhere(p: Principal): Prisma.RequestWhereInput {
  if (holdsGrant(p, 'request', 'read', 'organization')) return { deletedAt: null };
  const ors: Prisma.RequestWhereInput[] = [{ requesterUserId: p.userId }, { assigneeUserId: p.userId }];
  if (p.departmentIds.length && holdsGrant(p, 'request', 'read', 'department')) {
    ors.push({ targetDepartmentId: { in: p.departmentIds } });
  }
  return { deletedAt: null, OR: ors };
}

export interface RequestListItem {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  requester: string;
  assignee: string | null;
  department: string | null;
  dueDate: string | null;
}

export async function listRequests(): Promise<RequestListItem[]> {
  return tenantLoad('request', 'read', async ({ tx, principal }) => {
    const rows = await tx.request.findMany({
      where: requestVisibilityWhere(principal),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        targetDepartment: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      status: r.status,
      priority: r.priority,
      requester: r.requester.name ?? r.requester.email ?? '—',
      assignee: r.assignee?.name ?? r.assignee?.email ?? null,
      department: r.targetDepartment?.name ?? null,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    }));
  });
}

export interface RequestDetail extends RequestListItem {
  description: string | null;
  comments: Array<{ id: string; author: string; body: string; at: string }>;
}

export async function getRequest(id: string): Promise<RequestDetail | null> {
  return tenantLoad('request', 'read', async ({ tx, principal }) => {
    const r = await tx.request.findFirst({
      where: { id, ...requestVisibilityWhere(principal) },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        targetDepartment: { select: { name: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, createdAt: true, author: { select: { name: true, email: true } } },
        },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      requester: r.requester.name ?? r.requester.email ?? '—',
      assignee: r.assignee?.name ?? r.assignee?.email ?? null,
      department: r.targetDepartment?.name ?? null,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      comments: r.comments.map((c) => ({
        id: c.id,
        author: c.author.name ?? c.author.email ?? '—',
        body: c.body,
        at: c.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      })),
    };
  });
}

/** Departments a requester can route to (for the create form). */
export async function listDepartments(): Promise<Array<{ id: string; name: string }>> {
  return tenantLoad('request', 'create', ({ tx }) =>
    tx.department.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  );
}
