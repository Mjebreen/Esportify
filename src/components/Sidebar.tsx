'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Bell,
  Calculator,
  Calendar,
  CalendarDays,
  Camera,
  CheckCheck,
  ClipboardCheck,
  FileText,
  Gamepad2,
  Gauge,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plane,
  Receipt,
  Shirt,
  Tent,
  Trophy,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface SidebarNavItem {
  key: string;
  href: string;
  label: string;
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  approvals: CheckCheck,
  overview: Gauge,
  rosterCalculator: Calculator,
  players: Users,
  managers: UserCog,
  requests: Inbox,
  tasks: ListChecks,
  calendar: Calendar,
  media: Camera,
  tournaments: Trophy,
  contracts: FileText,
  salaries: Wallet,
  attendance: ClipboardCheck,
  performance: BarChart3,
  schedule: CalendarDays,
  bootcamps: Tent,
  merch: Shirt,
  trips: Plane,
  invoices: Receipt,
  portal: UserCircle,
  notifications: Bell,
};

// labelKey is a nav.groups.* i18n key so the headers localize with the rest of the shell.
const GROUPS: Array<{ labelKey: string | null; keys: string[] }> = [
  { labelKey: null, keys: ['dashboard', 'approvals'] },
  { labelKey: 'leadership', keys: ['overview', 'rosterCalculator'] },
  { labelKey: 'masterData', keys: ['players', 'managers'] },
  { labelKey: 'workflow', keys: ['requests', 'tasks', 'calendar', 'media'] },
  { labelKey: 'modules', keys: ['tournaments', 'contracts', 'salaries', 'attendance', 'performance', 'schedule', 'bootcamps', 'merch', 'trips', 'invoices'] },
  { labelKey: 'personal', keys: ['portal', 'notifications'] },
];

export function Sidebar({ brand, tagline, items }: { brand: string; tagline: string; items: SidebarNavItem[] }) {
  const pathname = usePathname();
  const tg = useTranslations('nav.groups');
  const byKey = new Map(items.map((i) => [i.key, i]));

  return (
    <aside className="flex w-64 shrink-0 flex-col border-e bg-surface">
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-indigo-400 text-white shadow-sm">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-fg">{brand}</div>
          <div className="text-xs text-muted">{tagline}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group, gi) => {
          const groupItems = group.keys.map((k) => byKey.get(k)).filter((x): x is SidebarNavItem => Boolean(x));
          if (groupItems.length === 0) return null;
          return (
            <div key={gi} className={gi === 0 ? '' : 'mt-5'}>
              {group.labelKey && (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                  {tg(group.labelKey as Parameters<typeof tg>[0])}
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {groupItems.map((item) => {
                  const Icon = ICONS[item.key] ?? LayoutDashboard;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active ? 'bg-accent/10 font-medium text-accent' : 'text-fg/80 hover:bg-surface-2 hover:text-fg'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-muted group-hover:text-fg'}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
