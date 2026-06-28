import { listApprovals } from '@/modules/approvals/queries';
import { ApprovalsClient } from './ApprovalsClient';

export default async function ApprovalsPage() {
  const view = await listApprovals();
  return <ApprovalsClient view={view} />;
}
