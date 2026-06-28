import Link from 'next/link';
import { ArrowRight, Boxes, Building2, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/client';
import { withOrgTx } from '@/server/db/tenant';
import { requirePrincipal } from '@/server/auth/session';
import { navFor } from '@/server/nav';

export default async function DashboardPage() {
  const principal = await requirePrincipal();
  const t = await getTranslations();

  const [org, user] = await Promise.all([
    withOrgTx(principal.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: principal.organizationId }, select: { name: true } }),
    ),
    prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, email: true } }),
  ]);

  const stats = [
    { icon: Building2, label: t('dashboard.org'), value: org?.name ?? '—' },
    { icon: ShieldCheck, label: t('dashboard.yourRoles'), value: principal.roleHints.join(', ') || '—' },
    { icon: Boxes, label: t('dashboard.modules'), value: `${principal.enabledModules.size} enabled` },
  ];

  // Role-aware quick links (skip Dashboard itself).
  const quick = navFor(principal)
    .filter((i) => i.key !== 'dashboard' && i.key !== 'notifications')
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('dashboard.welcome', { name: user?.name ?? user?.email ?? '' })}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card themed p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            <div className="mt-3 truncate text-lg font-semibold text-fg">{s.value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-fg">Quick access</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quick.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="card themed group flex items-center justify-between p-4 transition-colors hover:border-accent/40 hover:bg-surface-2"
          >
            <span className="text-sm font-medium text-fg">{t(item.labelKey as Parameters<typeof t>[0])}</span>
            <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent rtl:rotate-180" />
          </Link>
        ))}
      </div>
    </div>
  );
}
