import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { getPlayerDetail } from '@/modules/players/server/queries';
import { listPlayerMedia } from '@/modules/media/server/queries';
import { PlayerGallery } from './PlayerGallery';

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipal();
  const player = await getPlayerDetail(id);
  if (!player) notFound();

  const canUpload = authorize(principal, 'create', 'mediaAsset').allowed;
  const canDelete = authorize(principal, 'delete', 'mediaAsset').allowed;
  const media = await listPlayerMedia(id);

  const facts: Array<[string, string]> = [
    ['Name', `${player.firstName} ${player.lastName}`],
    ['Roster', player.rosterName ?? '—'],
    ['Jersey', player.jerseyNumber?.toString() ?? '—'],
    ['Status', player.status],
    ['Email', player.email ?? '—'],
    ['Phone', player.phone ?? '—'],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/players" className="text-sm text-accent hover:underline">
        ← Players
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-fg">{player.inGameName}</h1>

      <div className="mt-4 grid gap-3 card p-5 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
            <div className="text-sm font-medium text-fg">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <PlayerGallery playerId={player.id} media={media} canUpload={canUpload} canDelete={canDelete} />
      </div>
    </div>
  );
}
