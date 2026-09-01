import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize, holdsGrant } from '@/server/authz/gate';
import { listAnnouncements } from '@/modules/announcements/queries';
import { AnnouncementsClient } from './AnnouncementsClient';

export default async function AnnouncementsPage() {
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'announcement').allowed) notFound();
  const canPost = authorize(principal, 'create', 'announcement').allowed;
  const canModerate = holdsGrant(principal, 'announcement', 'manage', 'organization');
  const items = await listAnnouncements();

  return <AnnouncementsClient items={items} canPost={canPost} canModerate={canModerate} meUserId={principal.userId} />;
}
