import { CrudManager, type ColumnDef, type CrudAction, type FieldDef } from '@/components/CrudManager';
import { listEntity, type CrudDelegate } from '@/server/crud/factory';
import { can, rosterOptions } from '@/server/org/options';
import { createResult, deleteResult, updateResult } from '@/modules/results/actions';
import { rosterRecords } from '@/modules/results/queries';

export default async function ResultsPage() {
  const [rawRows, records, rosters, canCreate, canUpdate, canDelete] = await Promise.all([
    listEntity('matchResult', (tx) => tx.matchResult as unknown as CrudDelegate, {
      softDelete: true,
      orderBy: { playedAt: 'desc' },
      select: { id: true, kind: true, opponent: true, ourScore: true, theirScore: true, playedAt: true, notes: true, roster: { select: { name: true } } },
    }),
    rosterRecords(90),
    rosterOptions(),
    can('matchResult', 'create'),
    can('matchResult', 'update'),
    can('matchResult', 'delete'),
  ]);

  // Derive display-only fields: the composite score and a W/L/D outcome badge.
  const rows = rawRows.map((r) => {
    const ours = Number(r.ourScore);
    const theirs = Number(r.theirScore);
    return { ...r, score: `${ours}–${theirs}`, outcome: ours > theirs ? 'WIN' : ours < theirs ? 'LOSS' : 'DRAW' };
  });

  const columns: ColumnDef[] = [
    { key: 'roster', label: 'Roster', kind: 'rel', relField: 'name' },
    { key: 'opponent', label: 'Opponent' },
    { key: 'score', label: 'Score' },
    { key: 'outcome', label: 'Result', kind: 'status' },
    { key: 'kind', label: 'Type' },
    { key: 'playedAt', label: 'Played', kind: 'datetime' },
  ];
  const fields: FieldDef[] = [
    { name: 'rosterId', label: 'Roster', type: 'select', options: rosters, required: true, hideOnEdit: true },
    { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'SCRIM', label: 'SCRIM' }, { value: 'OFFICIAL', label: 'OFFICIAL' }] },
    { name: 'opponent', label: 'Opponent', type: 'text', required: true },
    { name: 'ourScore', label: 'Our score', type: 'number', required: true },
    { name: 'theirScore', label: 'Their score', type: 'number', required: true },
    { name: 'playedAt', label: 'Played at', type: 'datetime', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <>
      {records.length > 0 && (
        <div className="mx-auto mb-6 max-w-6xl">
          <h2 className="text-sm font-semibold text-fg">Win rates — last 90 days</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {records.map((r) => (
              <div key={r.rosterId} className="card flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm font-medium text-fg">{r.roster}</span>
                <span className="text-xs tabular-nums text-muted">
                  {r.wins}W–{r.losses}L{r.draws ? `–${r.draws}D` : ''}
                </span>
                <span className={`text-sm font-semibold tabular-nums ${r.winRate !== null && r.winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {r.winRate !== null ? `${r.winRate}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <CrudManager
        title="Results"
        subtitle="Scrim & official match results — win rates feed the overview"
        newLabel="Log result"
        emptyLabel="No results logged for your rosters yet."
        rows={rows}
        columns={columns}
        fields={fields}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        createAction={createResult as unknown as CrudAction}
        updateAction={updateResult as unknown as CrudAction}
        deleteAction={deleteResult as unknown as CrudAction}
      />
    </>
  );
}
