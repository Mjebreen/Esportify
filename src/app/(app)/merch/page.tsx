import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createJersey, createMerchProfile, deleteJersey, deleteMerchProfile, updateJersey, updateMerchProfile } from '@/modules/merch/actions';

export default async function MerchPage() {
  const [profiles, jerseys, players, profileCan, jerseyCan] = await Promise.all([
    listEntity('merchProfile', (tx) => tx.merchSizeProfile as unknown as CrudDelegate, {
      softDelete: false,
      orderBy: { createdAt: 'desc' },
      select: { id: true, jerseySize: true, jacketSize: true, shoeSize: true, notes: true, player: { select: { inGameName: true } } },
    }),
    listEntity('jerseyEntitlement', (tx) => tx.jerseyEntitlement as unknown as CrudDelegate, {
      softDelete: false,
      orderBy: { createdAt: 'desc' },
      select: { id: true, season: true, allocated: true, claimed: true, notes: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    Promise.all([can('merchProfile', 'create'), can('merchProfile', 'update'), can('merchProfile', 'delete')]),
    Promise.all([can('jerseyEntitlement', 'create'), can('jerseyEntitlement', 'update'), can('jerseyEntitlement', 'delete')]),
  ]);

  const profileCols: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'jerseySize', label: 'Jersey' },
    { key: 'jacketSize', label: 'Jacket' },
    { key: 'shoeSize', label: 'Shoe' },
  ];
  const profileFields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'jerseySize', label: 'Jersey size', type: 'text' },
    { name: 'jacketSize', label: 'Jacket size', type: 'text' },
    { name: 'shoeSize', label: 'Shoe size', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const jerseyCols: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'season', label: 'Season' },
    { key: 'allocated', label: 'Allocated' },
    { key: 'claimed', label: 'Claimed' },
  ];
  const jerseyFields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'season', label: 'Season', type: 'text', required: true },
    { name: 'allocated', label: 'Allocated', type: 'number' },
    { name: 'claimed', label: 'Claimed', type: 'number' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <div className="space-y-10">
      <CrudManager
        title="Merch — size profiles"
        subtitle="Jersey / jacket / shoe sizes per player"
        newLabel="New size profile"
        emptyLabel="No size profiles yet."
        rows={profiles}
        columns={profileCols}
        fields={profileFields}
        canCreate={profileCan[0]}
        canUpdate={profileCan[1]}
        canDelete={profileCan[2]}
        createAction={createMerchProfile as unknown as CrudAction}
        updateAction={updateMerchProfile as unknown as CrudAction}
        deleteAction={deleteMerchProfile as unknown as CrudAction}
      />
      <CrudManager
        title="Merch — jersey entitlements"
        subtitle="Allocated vs claimed per player / season"
        newLabel="New entitlement"
        emptyLabel="No entitlements yet."
        rows={jerseys}
        columns={jerseyCols}
        fields={jerseyFields}
        canCreate={jerseyCan[0]}
        canUpdate={jerseyCan[1]}
        canDelete={jerseyCan[2]}
        createAction={createJersey as unknown as CrudAction}
        updateAction={updateJersey as unknown as CrudAction}
        deleteAction={deleteJersey as unknown as CrudAction}
      />
    </div>
  );
}
