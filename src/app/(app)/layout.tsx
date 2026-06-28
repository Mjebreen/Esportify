import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/client';
import { requirePrincipal } from '@/server/auth/session';
import { listUserOrganizations } from '@/server/auth/principal';
import { navFor } from '@/server/nav';
import { THEME_COOKIE } from '@/server/theme';
import { unreadNotificationCount } from '@/modules/notifications/server/queries';
import { Sidebar, type SidebarNavItem } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipal();
  const t = await getTranslations();

  const [orgs, user, unread, cookieStore] = await Promise.all([
    listUserOrganizations(principal.userId),
    prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, email: true } }),
    unreadNotificationCount().catch(() => 0),
    cookies(),
  ]);
  const theme = cookieStore.get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';

  const navItems: SidebarNavItem[] = navFor(principal).map((item) => ({
    key: item.key,
    href: item.href,
    label: t(item.labelKey as Parameters<typeof t>[0]),
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar brand={t('app.name')} tagline={t('app.tagline')} items={navItems} />
      <div className="flex flex-1 flex-col">
        <Topbar
          orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
          currentOrgId={principal.organizationId}
          userName={user?.name ?? user?.email ?? '—'}
          roles={principal.roleHints}
          unread={unread}
          theme={theme}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
