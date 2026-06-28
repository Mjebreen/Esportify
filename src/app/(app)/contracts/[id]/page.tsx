import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { getContractDetail } from '@/modules/contracts/queries';
import { ContractDetailClient } from './ContractDetailClient';

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipal();
  const canEdit = authorize(principal, 'update', 'contract').allowed;
  const contract = await getContractDetail(id);
  if (!contract) notFound();
  return <ContractDetailClient contract={contract} canEdit={canEdit} />;
}
