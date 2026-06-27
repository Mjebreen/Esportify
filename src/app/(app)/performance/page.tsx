import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, playerOptions } from '@/server/org/options';
import { createPerformance, deletePerformance, updatePerformance } from '@/modules/performance/actions';

const playerName = (_v: unknown, row: Record<string, unknown>) =>
  String((row.player as { inGameName?: string })?.inGameName ?? '—');

export default async function PerformancePage() {
  const [rows, players, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('performance', (tx) => tx.performanceRecord as unknown as CrudDelegate, {
      softDelete: false,
      orderBy: { matchDate: 'desc' },
      select: { id: true, matchDate: true, opponent: true, metric: true, value: true, notes: true, player: { select: { inGameName: true } } },
    }),
    playerOptions(),
    can('performance', 'create'),
    can('performance', 'update'),
    can('performance', 'delete'),
  ]);

  const columns: ColumnDef[] = [
    { key: 'player', label: 'Player', format: playerName },
    { key: 'matchDate', label: 'Match', format: (v) => String(v).slice(0, 10) },
    { key: 'opponent', label: 'Opponent' },
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value' },
  ];
  const fields: FieldDef[] = [
    { name: 'playerId', label: 'Player', type: 'select', options: players, required: true, hideOnEdit: true },
    { name: 'matchDate', label: 'Match date', type: 'date', required: true },
    { name: 'opponent', label: 'Opponent', type: 'text' },
    { name: 'metric', label: 'Metric (e.g. K/D, ACS)', type: 'text', required: true },
    { name: 'value', label: 'Value', type: 'number', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Performance"
      subtitle="Per-match performance metrics"
      newLabel="Add record"
      emptyLabel="No performance records visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createPerformance as unknown as CrudAction}
      updateAction={updatePerformance as unknown as CrudAction}
      deleteAction={deletePerformance as unknown as CrudAction}
    />
  );
}
