import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createTrip, deleteTrip, updateTrip } from '@/modules/trips/actions';

export default async function TripsPage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('trip', (tx) => tx.trip as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { departAt: 'asc' },
      select: { id: true, purpose: true, origin: true, destination: true, departAt: true, returnAt: true, status: true, notes: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('trip', 'create'),
    can('trip', 'update'),
    can('trip', 'delete'),
  ]);

  const statusOpts = ['REQUESTED', 'BOOKED', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName', fallback: 'Group' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'destination', label: 'Destination' },
    { key: 'departAt', label: 'Depart', kind: 'datetime' },
    { key: 'status', label: 'Status' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player (optional — blank = group)', type: 'select', options: players, hideOnEdit: true },
    { name: 'purpose', label: 'Purpose', type: 'text', required: true },
    { name: 'origin', label: 'Origin', type: 'text' },
    { name: 'destination', label: 'Destination', type: 'text' },
    { name: 'departAt', label: 'Depart at', type: 'datetime' },
    { name: 'returnAt', label: 'Return at', type: 'datetime' },
    { name: 'status', label: 'Status', type: 'select', options: statusOpts },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Travel"
      subtitle="Trips & group bookings (Aviation)"
      newLabel="New trip"
      emptyLabel="No trips visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      detailBase="/trips"
      createAction={createTrip as unknown as CrudAction}
      updateAction={updateTrip as unknown as CrudAction}
      deleteAction={deleteTrip as unknown as CrudAction}
    />
  );
}
