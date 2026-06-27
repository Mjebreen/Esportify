import { listNotifications } from '@/modules/notifications/server/queries';
import { NotificationsClient } from './NotificationsClient';

export default async function NotificationsPage() {
  const notifications = await listNotifications();
  return <NotificationsClient notifications={notifications} />;
}
