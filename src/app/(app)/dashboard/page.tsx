import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/client';
import { withOrgTx } from '@/server/db/tenant';
import { requirePrincipal } from '@/server/auth/session';

export default async function DashboardPage() {
  const principal = await requirePrincipal();
  const t = await getTranslations();

  const [org, user] = await Promise.all([
    withOrgTx(principal.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: principal.organizationId }, select: { name: true, slug: true } }),
    ),
    prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, email: true } }),
  ]);

  const cards: Array<{ label: string; value: string }> = [
    { label: t('dashboard.org'), value: org?.name ?? '—' },
    { label: t('dashboard.yourRoles'), value: principal.roleHints.join(', ') || '—' },
    { label: t('dashboard.modules'), value: [...principal.enabledModules].join(', ') },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-fg">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-muted">
        {t('dashboard.welcome', { name: user?.name ?? user?.email ?? '' })}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-surface p-5">
            <div className="text-xs uppercase tracking-wide text-muted">{c.label}</div>
            <div className="mt-2 text-sm font-medium text-fg">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
