import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listAssignableRosters, listPlayers } from '@/modules/players/server/queries';
import { PlayersClient } from './PlayersClient';

export default async function PlayersPage() {
  const principal = await requirePrincipal();
  const canCreate = authorize(principal, 'create', 'player').allowed;
  const canUpdate = authorize(principal, 'update', 'player').allowed;
  const canDelete = authorize(principal, 'delete', 'player').allowed;

  const [players, rosters] = await Promise.all([
    listPlayers(),
    canCreate || canUpdate ? listAssignableRosters() : Promise.resolve([]),
  ]);

  return (
    <PlayersClient
      players={players}
      rosters={rosters}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
