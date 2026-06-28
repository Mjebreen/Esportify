import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { getTripDetail } from '@/modules/trips/queries';
import { TripDetailClient } from './TripDetailClient';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipal();
  const canEdit = authorize(principal, 'update', 'trip').allowed;
  const trip = await getTripDetail(id);
  if (!trip) notFound();
  return <TripDetailClient trip={trip} canEdit={canEdit} />;
}
