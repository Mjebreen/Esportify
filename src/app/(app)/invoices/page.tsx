import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize, holdsGrant } from '@/server/authz/gate';
import { listInvoicesWorkflow } from '@/modules/invoices/queries';
import { InvoicesClient } from './InvoicesClient';

export default async function InvoicesPage() {
  const principal = await requirePrincipal();
  if (!authorize(principal, 'read', 'invoice').allowed) notFound();
  const canSubmit = !!principal.playerId && authorize(principal, 'create', 'invoice').allowed;
  // SoD: only the player's MANAGER (roster scope) approves/rejects — not finance (org scope).
  // Admins (org scope but admin role) retain the override.
  const updateDecision = authorize(principal, 'update', 'invoice');
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  const canApprove = updateDecision.allowed && (updateDecision.scope === 'roster' || isAdmin);
  const canPay = holdsGrant(principal, 'invoice', 'update', 'organization');
  const invoices = await listInvoicesWorkflow();

  return <InvoicesClient invoices={invoices} canSubmit={canSubmit} canApprove={canApprove} canPay={canPay} />;
}
