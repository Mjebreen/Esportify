import { requirePrincipal } from '@/server/auth/session';
import { rosterOptions } from '@/server/org/options';
import { listPhotoRequests } from '@/modules/media/photo-queries';
import { MediaClient } from './MediaClient';

export default async function MediaPage() {
  const principal = await requirePrincipal();
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  const canCreate = principal.managedRosterIds.length > 0 || principal.roleHints.includes('MARCOM') || isAdmin;

  const [requests, rosters] = await Promise.all([
    listPhotoRequests(),
    canCreate ? rosterOptions() : Promise.resolve([]),
  ]);

  return <MediaClient requests={requests} canCreate={canCreate} rosters={rosters} />;
}
