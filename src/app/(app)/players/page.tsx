import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { listAssignableRosters, listPlayers } from '@/modules/players/server/queries';
import { PlayersClient } from './PlayersClient';

export default async function PlayersPage() {
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'player').allowed) notFound();
  const canCreate = authorize(principal, 'create', 'player').allowed;
  const updateDecision = authorize(principal, 'update', 'player');
  const canUpdate = updateDecision.allowed;
  const canDelete = authorize(principal, 'delete', 'player').allowed;
  // For self-service (own scope) the form must show only the fields the grant allows
  // (e.g. firstName/lastName/phone), so the UI matches what the server will accept.
  const selfEditFields = updateDecision.allowed && updateDecision.scope === 'own' ? updateDecision.constraints?.fields ?? [] : null;
  // Only fetch the roster list if the caller can actually read rosters — a Player has
  // update:own but no roster grant, so listAssignableRosters() would otherwise throw.
  const canReadRosters = authorize(principal, 'read', 'roster').allowed;

  const [players, rosters] = await Promise.all([
    listPlayers(),
    canReadRosters ? listAssignableRosters() : Promise.resolve([]),
  ]);

  return (
    <PlayersClient
      players={players}
      rosters={rosters}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      selfEditFields={selfEditFields}
    />
  );
}
