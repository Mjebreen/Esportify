import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listOrgMembers } from '@/server/org/members';
import { getRequest } from '@/modules/requests/server/queries';
import { RequestDetailClient } from './RequestDetailClient';

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipal();
  const canUpdate = authorize(principal, 'update', 'request').allowed;

  const request = await getRequest(id);
  if (!request) notFound();

  const members = canUpdate ? await listOrgMembers() : [];
  return <RequestDetailClient request={request} members={members} canUpdate={canUpdate} />;
}
