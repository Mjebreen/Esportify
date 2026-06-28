import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createContract, deleteContract, updateContract } from '@/modules/contracts/actions';

export default async function ContractsPage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('contract', (tx) => tx.contract as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { endDate: 'asc' },
      select: { id: true, status: true, startDate: true, endDate: true, salaryAmount: true, currency: true, buyout: true, prizeSplitPct: true, notes: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('contract', 'create'),
    can('contract', 'update'),
    can('contract', 'delete'),
  ]);

  const statusOpts = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start', kind: 'date' },
    { key: 'endDate', label: 'End', kind: 'date' },
    { key: 'salaryAmount', label: 'Salary', kind: 'money' },
    { key: 'prizeSplitPct', label: 'Prize %', kind: 'percent' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'status', label: 'Status', type: 'select', options: statusOpts },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date', required: true },
    { name: 'salaryAmount', label: 'Salary amount', type: 'number' },
    { name: 'currency', label: 'Currency', type: 'text' },
    { name: 'buyout', label: 'Buyout', type: 'number' },
    { name: 'prizeSplitPct', label: 'Prize split %', type: 'number' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Contracts"
      subtitle="Terms, dates, salary, buyout & tournament prize split"
      newLabel="New contract"
      emptyLabel="No contracts visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      detailBase="/contracts"
      createAction={createContract as unknown as CrudAction}
      updateAction={updateContract as unknown as CrudAction}
      deleteAction={deleteContract as unknown as CrudAction}
    />
  );
}
