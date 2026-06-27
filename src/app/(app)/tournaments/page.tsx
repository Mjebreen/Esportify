import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, gameTitleOptions, rosterOptions } from '@/server/org/options';
import { createTournament, deleteTournament, updateTournament } from '@/modules/tournaments/actions';

const rel = (key: string, sub: string) => (_v: unknown, row: Record<string, unknown>) =>
  String((row[key] as Record<string, string>)?.[sub] ?? '—');

export default async function TournamentsPage() {
  const [rows, titles, rosters, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('tournament', (tx) => tx.tournament as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, status: true, startDate: true, endDate: true, placement: true, prizePool: true, prizeCurrency: true, gameTitle: { select: { name: true } }, roster: { select: { name: true } } },
    }),
    gameTitleOptions(),
    rosterOptions(),
    can('tournament', 'create'),
    can('tournament', 'update'),
    can('tournament', 'delete'),
  ]);

  const statusOpts = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s }));
  const columns: ColumnDef[] = [
    { key: 'name', label: 'Tournament' },
    { key: 'gameTitle', label: 'Title', format: rel('gameTitle', 'name') },
    { key: 'roster', label: 'Roster', format: rel('roster', 'name') },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start', format: (v) => String(v).slice(0, 10) },
    { key: 'placement', label: 'Place' },
    { key: 'prizePool', label: 'Prize', format: (v, row) => (v ? `${v} ${row.prizeCurrency ?? ''}` : '—') },
  ];
  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'gameTitleId', label: 'Game title', type: 'select', options: titles, required: true, hideOnEdit: true },
    { name: 'rosterId', label: 'Roster', type: 'select', options: rosters, hideOnEdit: true },
    { name: 'status', label: 'Status', type: 'select', options: statusOpts },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date' },
    { name: 'placement', label: 'Placement', type: 'number' },
    { name: 'prizePool', label: 'Prize pool', type: 'number' },
    { name: 'prizeCurrency', label: 'Prize currency', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <CrudManager
      title="Tournaments"
      subtitle="Name, title, dates, placement, prize pool"
      newLabel="New tournament"
      emptyLabel="No tournaments visible to your role."
      rows={rows}
      columns={columns}
      fields={fields}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      createAction={createTournament as unknown as CrudAction}
      updateAction={updateTournament as unknown as CrudAction}
      deleteAction={deleteTournament as unknown as CrudAction}
    />
  );
}
