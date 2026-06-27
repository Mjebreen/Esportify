import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listDepartments, listRequests } from '@/modules/requests/server/queries';
import { RequestsClient } from './RequestsClient';

export default async function RequestsPage() {
  const principal = await requirePrincipal();
  const canCreate = authorize(principal, 'create', 'request').allowed;
  const [requests, departments] = await Promise.all([listRequests(), canCreate ? listDepartments() : Promise.resolve([])]);
  return <RequestsClient requests={requests} departments={departments} canCreate={canCreate} />;
}
