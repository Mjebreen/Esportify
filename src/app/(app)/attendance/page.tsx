import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions, scheduleOptions } from '@/server/org/options';
import { createAttendance, deleteAttendance, updateAttendance } from '@/modules/attendance/actions';

export default async function AttendancePage() {
  const [rows, players, sessions, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('attendance', (tx) => tx.attendance as unknown as CrudDelegate, {
      softDelete: false,
      orderBy: { date: 'desc' },
      select: { id: true, type: true, date: true, minutesLate: true, reason: true, player: { select: { inGameName: true } }, schedule: { select: { title: true } } },
    }),
    playerOptions(),
    scheduleOptions(),
    can('attendance', 'create'),
    can('attendance', 'update'),
    can('attendance', 'delete'),
  ]);

  const typeOpts = ['PRESENT', 'ABSENCE', 'TARDINESS', 'EXCUSED'].map((s) => ({ value: s, label: s }));
  const sessionOpts = [{ value: '', label: '—' }, ...sessions];
  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'schedule', label: 'Session', kind: 'rel', relField: 'title' },
    { key: 'type', label: 'Status', kind: 'status' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'minutesLate', label: 'Mins late' },
    { key: 'reason', label: 'Reason' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'scheduleId', label: 'Practice session', type: 'select', options: sessionOpts },
    { name: 'type', label: 'Status', type: 'select', options: typeOpts, required: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'minutesLate', label: 'Minutes late', type: 'number' },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Attendance"
      subtitle="Practice-session attendance log (present / absent / late / excused)"
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
