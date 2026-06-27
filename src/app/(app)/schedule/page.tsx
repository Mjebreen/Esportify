import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, rosterOptions } from '@/server/org/options';
import { createSchedule, deleteSchedule, updateSchedule } from '@/modules/schedules/actions';

const dt = (v: unknown) => (v ? String(v).slice(0, 16).replace('T', ' ') : '—');

export default async function SchedulePage() {
  const [rows, rosters, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('schedule', (tx) => tx.schedule as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { startAt: 'asc' },
      select: { id: true, type: true, title: true, startAt: true, endAt: true, notes: true, roster: { select: { name: true } } },
    }),
    rosterOptions(),
    can('schedule', 'create'),
    can('schedule', 'update'),
    can('schedule', 'delete'),
  ]);

  const typeOpts = ['PRACTICE', 'SCRIM', 'MEETING', 'REVIEW'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'title', label: 'Title' },
    { key: 'roster', label: 'Roster', format: (_v, row) => String((row.roster as { name?: string })?.name ?? '—') },
    { key: 'type', label: 'Type' },
    { key: 'startAt', label: 'Start', format: dt },
    { key: 'endAt', label: 'End', format: dt },
  ];
  const fields: FieldDef[] = [
    { name: 'rosterId', label: 'Roster', type: 'select', options: rosters, hideOnEdit: true },
    { name: 'type', label: 'Type', type: 'select', options: typeOpts },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'startAt', label: 'Start', type: 'datetime', required: true },
    { name: 'endAt', label: 'End', type: 'datetime' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Schedule"
      subtitle="Practice / scrim / meeting schedule"
      newLabel="New session"
      emptyLabel="No sessions visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createSchedule as unknown as CrudAction}
      updateAction={updateSchedule as unknown as CrudAction}
      deleteAction={deleteSchedule as unknown as CrudAction}
    />
  );
}
