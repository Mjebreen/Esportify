import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listOrgMembers } from '@/server/org/members';
import { listTasks } from '@/modules/tasks/server/queries';
import { TasksClient } from './TasksClient';

export default async function TasksPage() {
  const principal = await requirePrincipal();
  const canCreate = authorize(principal, 'create', 'task').allowed;
  const canUpdate = authorize(principal, 'update', 'task').allowed;
  const [tasks, members] = await Promise.all([listTasks(), canCreate ? listOrgMembers() : Promise.resolve([])]);
  return <TasksClient tasks={tasks} members={members} canCreate={canCreate} canUpdate={canUpdate} />;
}
