import Link from 'next/link';
import { ArrowRight, Bell, CalendarDays, CheckCheck, Inbox, Megaphone, Pin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/client';
import { requirePrincipal } from '@/server/auth/session';
import { authorize } from '@/server/authz/gate';
import { tenantLoad } from '@/server/action';
import { navFor } from '@/server/nav';
import { listAnnouncements, type AnnouncementItem } from '@/modules/announcements/queries';
import { listApprovals } from '@/modules/approvals/queries';
import { unreadNotificationCount } from '@/modules/notifications/server/queries';
import { requestVisibilityWhere } from '@/modules/requests/server/queries';

export default async function DashboardPage() {
  const principal = await requirePrincipal();
  const t = await getTranslations();
  const canSchedule = authorize(principal, 'read', 'schedule').allowed;
  const canRequests = authorize(principal, 'read', 'request').allowed;
  const canAnnouncements = authorize(principal, 'read', 'announcement').allowed;

  // Everything on the landing page is live, role-scoped work state — loaded concurrently.
  const [user, approvals, unread, announcements, nextSession, openRequests] = await Promise.all([
    prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, email: true } }),
    listApprovals(),
    unreadNotificationCount().catch(() => 0),
    canAnnouncements ? listAnnouncements(3) : Promise.resolve([] as AnnouncementItem[]),
    canSchedule
      ? tenantLoad('schedule', 'read', ({ tx, where }) =>
          tx.schedule.findFirst({
            where: { deletedAt: null, startAt: { gte: new Date() }, ...where },
            orderBy: { startAt: 'asc' },
            select: { title: true, startAt: true, type: true },
          }),
        )
      : null,
    canRequests
      ? tenantLoad('request', 'read', ({ tx }) =>
          tx.request.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'BLOCKED'] }, ...requestVisibilityWhere(principal) } }),
        )
      : null,
  ]);

  const actionable = approvals.toApprove.length + approvals.toExecute.length;

  const tiles: Array<{ href: string; icon: typeof CheckCheck; label: string; value: string; highlight: boolean }> = [
    {
      href: '/approvals',
      icon: CheckCheck,
      label: t('dashboard.approvalsTile'),
      value: String(actionable),
      highlight: actionable > 0,
    },
    {
      href: '/notifications',
      icon: Bell,
      label: t('dashboard.notificationsTile'),
      value: String(unread),
      highlight: unread > 0,
    },
  ];
  if (openRequests !== null) {
    tiles.push({ href: '/requests', icon: Inbox, label: t('dashboard.requestsTile'), value: String(openRequests), highlight: false });
  }
  if (canSchedule) {
    tiles.push({
      href: '/schedule',
      icon: CalendarDays,
      label: t('dashboard.nextSession'),
      value: nextSession
        ? `${nextSession.title} · ${nextSession.startAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
        : '—',
      highlight: false,
    });
  }

  // Role-aware quick links (skip Dashboard itself + the tiles above).
  const quick = navFor(principal)
    .filter((i) => !['dashboard', 'notifications', 'approvals'].includes(i.key))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('dashboard.welcome', { name: user?.name ?? user?.email ?? '' })}</p>

      <h2 className="mt-6 text-sm font-semibold text-fg">{t('dashboard.waiting')}</h2>
      {actionable === 0 && unread === 0 && <p className="mt-2 text-sm text-muted">{t('dashboard.nothingWaiting')}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`card themed group p-5 transition-colors hover:border-accent/40 hover:bg-surface-2 ${
              s.highlight ? 'border-accent/40' : ''
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <s.icon className={`h-4 w-4 ${s.highlight ? 'text-accent' : ''}`} />
              {s.label}
            </div>
            <div className={`mt-3 truncate text-lg font-semibold ${s.highlight ? 'text-accent' : 'text-fg'}`}>{s.value}</div>
          </Link>
        ))}
      </div>

      {announcements.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-fg">
            <Link href="/announcements" className="hover:text-accent hover:underline">
              {t('dashboard.announcements')}
            </Link>
          </h2>
          <div className="mt-3 space-y-2">
            {announcements.map((a) => (
              <Link key={a.id} href="/announcements" className={`card block p-4 transition-colors hover:bg-surface-2 ${a.pinned ? 'border-accent/40' : ''}`}>
                <div className="flex items-center gap-2">
                  {a.pinned ? <Pin className="h-4 w-4 shrink-0 text-accent" /> : <Megaphone className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="truncate text-sm font-medium text-fg">{a.title}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted">{a.author} · {a.at}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-fg">{t('dashboard.quickAccess')}</h2>
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
