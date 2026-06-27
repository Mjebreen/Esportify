import type { Prisma } from '@prisma/client';
import { tenantLoad } from '@/server/action';

export interface TaskListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  creator: string;
  dueDate: string | null;
}

export async function listTasks(): Promise<TaskListItem[]> {
  return tenantLoad('task', 'read', async ({ tx, where }) => {
    const rows = await tx.task.findMany({
      where: { deletedAt: null, ...(where as Prisma.TaskWhereInput) },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { name: true, email: true } },
        creator: { select: { name: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee?.name ?? r.assignee?.email ?? null,
      creator: r.creator.name ?? r.creator.email ?? '—',
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    }));
  });
}
