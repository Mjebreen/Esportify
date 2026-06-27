import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createSalary, deleteSalary, updateSalary } from '@/modules/salaries/actions';

const playerName = (_v: unknown, row: Record<string, unknown>) =>
  String((row.player as { inGameName?: string })?.inGameName ?? '—');
const date = (v: unknown) => (v ? String(v).slice(0, 10) : '—');

export default async function SalariesPage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('salary', (tx) => tx.salary as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { effectiveFrom: 'desc' },
      select: { id: true, amount: true, currency: true, effectiveFrom: true, effectiveTo: true, note: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('salary', 'create'),
    can('salary', 'update'),
    can('salary', 'delete'),
  ]);

  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', format: playerName },
    { key: 'amount', label: 'Amount', format: (v, row) => `${v} ${row.currency ?? ''}` },
    { key: 'effectiveFrom', label: 'From', format: date },
    { key: 'effectiveTo', label: 'To', format: date },
    { key: 'note', label: 'Note' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
    { name: 'currency', label: 'Currency', type: 'text' },
    { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true },
    { name: 'effectiveTo', label: 'Effective to', type: 'date' },
    { name: 'note', label: 'Note', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Salaries"
      subtitle="Player salary records (sensitive — redacted in the audit log)"
      newLabel="New salary"
      emptyLabel="No salaries visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createSalary as unknown as CrudAction}
      updateAction={updateSalary as unknown as CrudAction}
      deleteAction={deleteSalary as unknown as CrudAction}
    />
  );
}
