import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createInvoice, deleteInvoice, updateInvoice } from '@/modules/invoices/actions';

export default async function InvoicesPage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('invoice', (tx) => tx.invoice as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { issuedAt: 'desc' },
      select: { id: true, number: true, amount: true, currency: true, status: true, issuedAt: true, dueAt: true, notes: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('invoice', 'create'),
    can('invoice', 'update'),
    can('invoice', 'delete'),
  ]);

  const statusOpts = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'number', label: 'Invoice #' },
    { key: 'player', label: 'Player', kind: 'rel', relField: 'inGameName' },
    { key: 'amount', label: 'Amount', kind: 'money' },
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'issuedAt', label: 'Issued', kind: 'date' },
    { key: 'dueAt', label: 'Due', kind: 'date' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'number', label: 'Invoice number', type: 'text', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
    { name: 'currency', label: 'Currency', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: statusOpts },
    { name: 'issuedAt', label: 'Issued at', type: 'date', required: true },
    { name: 'dueAt', label: 'Due at', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Invoices"
      subtitle="Billing statements"
      newLabel="New invoice"
      emptyLabel="No invoices visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createInvoice as unknown as CrudAction}
      updateAction={updateInvoice as unknown as CrudAction}
      deleteAction={deleteInvoice as unknown as CrudAction}
    />
  );
}
