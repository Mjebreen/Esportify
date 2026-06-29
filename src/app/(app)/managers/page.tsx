import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listManagers } from '@/modules/managers/server/queries';
import { ManagersClient } from './ManagersClient';

export default async function ManagersPage() {
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'manager').allowed) notFound();
  const canCreate = authorize(principal, 'create', 'manager').allowed;
  const canUpdate = authorize(principal, 'update', 'manager').allowed;
  const canDelete = authorize(principal, 'delete', 'manager').allowed;
  const managers = await listManagers();

  return (
    <ManagersClient managers={managers} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
  );
}
