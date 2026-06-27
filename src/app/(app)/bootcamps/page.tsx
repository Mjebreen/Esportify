import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can } from '@/server/org/options';
import { createBootcamp, deleteBootcamp, updateBootcamp } from '@/modules/bootcamps/actions';

const date = (v: unknown) => (v ? String(v).slice(0, 10) : '—');

export default async function BootcampsPage() {
  const [rows, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('bootcamp', (tx) => tx.bootcamp as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, location: true, startDate: true, endDate: true, notes: true },
    }),
    can('bootcamp', 'create'),
    can('bootcamp', 'update'),
    can('bootcamp', 'delete'),
  ]);

  const columns: ColumnDef[] = [
    { key: 'name', label: 'Bootcamp' },
    { key: 'location', label: 'Location' },
    { key: 'startDate', label: 'Start', format: date },
    { key: 'endDate', label: 'End', format: date },
  ];
  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'location', label: 'Location', type: 'text' },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Bootcamps"
      subtitle="Training-camp records"
      newLabel="New bootcamp"
      emptyLabel="No bootcamps yet."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createBootcamp as unknown as CrudAction}
      updateAction={updateBootcamp as unknown as CrudAction}
      deleteAction={deleteBootcamp as unknown as CrudAction}
    />
  );
}
