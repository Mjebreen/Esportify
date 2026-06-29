import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { playerOptions } from '@/server/org/options';
import { listAdjustments, payrollForPeriod, currentPeriod } from '@/modules/salaries/payroll';
import { SalariesClient } from './SalariesClient';

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const principal = await requirePrincipal();
  // Defense-in-depth: enforce the SALARIES module toggle + salary:read grant (matches nav).
  if (!authorize(principal, 'read', 'salary').allowed) notFound();
  const isAdmin = principal.roleHints.some((r) => r === 'SUPER_ADMIN' || r === 'IT');
  const canAdjust = principal.managedRosterIds.length > 0 || isAdmin;
  const canSeePayroll = principal.roleHints.some((r) => ['FINANCE', 'LEADERSHIP', 'SUPER_ADMIN', 'IT'].includes(r));
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? '') ? sp.period! : currentPeriod(new Date());

  const [adjustments, payroll, players] = await Promise.all([
    listAdjustments(),
    canSeePayroll ? payrollForPeriod(period) : Promise.resolve([]),
    canAdjust ? playerOptions() : Promise.resolve([]),
  ]);

  return (
    <SalariesClient
      canAdjust={canAdjust}
      canSeePayroll={canSeePayroll}
      period={period}
      players={players}
      adjustments={adjustments}
      payroll={payroll}
    />
  );
}
