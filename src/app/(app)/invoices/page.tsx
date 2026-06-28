import { requirePrincipal } from '@/server/auth/session';
import { authorize, holdsGrant } from '@/server/authz/gate';
import { listInvoicesWorkflow } from '@/modules/invoices/queries';
import { InvoicesClient } from './InvoicesClient';

export default async function InvoicesPage() {
  const principal = await requirePrincipal();
  const canSubmit = !!principal.playerId && authorize(principal, 'create', 'invoice').allowed;
  const canApprove = holdsGrant(principal, 'invoice', 'update', 'roster');
  const canPay = holdsGrant(principal, 'invoice', 'update', 'organization');
  const invoices = await listInvoicesWorkflow();

  return <InvoicesClient invoices={invoices} canSubmit={canSubmit} canApprove={canApprove} canPay={canPay} />;
}
