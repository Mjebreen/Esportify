import { requirePrincipal } from '@/server/auth/session';
import { playerOptions } from '@/server/org/options';
import { listTravel } from '@/modules/travel/queries';
import { TravelClient } from './TravelClient';

export default async function TravelPage() {
  const principal = await requirePrincipal();
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  const canCreate = principal.managedRosterIds.length > 0 || isAdmin;

  const [travel, passengers] = await Promise.all([
    listTravel(),
    canCreate ? playerOptions() : Promise.resolve([]),
  ]);

  return <TravelClient travel={travel} canCreate={canCreate} passengers={passengers} />;
}
