import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createAttendance, deleteAttendance, updateAttendance } from '@/modules/attendance/actions';

export default async function AttendancePage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('attendance', (tx) => tx.attendance as unknown as CrudDelegate, {
      softDelete: false,
      orderBy: { date: 'desc' },
      select: { id: true, type: true, date: true, minutesLate: true, reason: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('attendance', 'create'),
    can('attendance', 'update'),
    can('attendance', 'delete'),
  ]);

  const typeOpts = ['ABSENCE', 'TARDINESS'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'type', label: 'Type' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'minutesLate', label: 'Mins late' },
    { key: 'reason', label: 'Reason' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'type', label: 'Type', type: 'select', options: typeOpts, required: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'minutesLate', label: 'Minutes late', type: 'number' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Attendance"
      subtitle="Absences & tardiness log"
      newLabel="Log entry"
      emptyLabel="No attendance entries visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createAttendance as unknown as CrudAction}
      updateAction={updateAttendance as unknown as CrudAction}
      deleteAction={deleteAttendance as unknown as CrudAction}
    />
  );
}
