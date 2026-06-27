import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/client';
import { withOrgTx } from '@/server/db/tenant';
import { requirePrincipal } from '@/server/auth/session';
import { navFor } from '@/server/nav';
import { Sidebar, type SidebarNavItem } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipal();
  const t = await getTranslations();

  const [org, user] = await Promise.all([
    withOrgTx(principal.organizationId, (tx) =>
      tx.organization.findUnique({ where: { id: principal.organizationId }, select: { name: true } }),
    ),
    prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, email: true } }),
  ]);

  const navItems: SidebarNavItem[] = navFor(principal).map((item) => ({
    key: item.key,
    href: item.href,
    label: t(item.labelKey as Parameters<typeof t>[0]),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar brand={t('app.name')} tagline={t('app.tagline')} items={navItems} />
      <div className="flex flex-1 flex-col">
        <Topbar
          orgName={org?.name ?? '—'}
          userName={user?.name ?? user?.email ?? '—'}
          roles={principal.roleHints}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
