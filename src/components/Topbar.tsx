import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Theme } from '@/server/theme';
import { LocaleSwitcher } from './LocaleSwitcher';
import { OrgSwitcher, type OrgOption } from './OrgSwitcher';
import { SearchPalette } from './SearchPalette';
import { SignOutButton } from './SignOutButton';
import { ThemeToggle } from './ThemeToggle';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Topbar({
  orgs,
  currentOrgId,
  userName,
  roles,
  unread,
  theme,
}: {
  orgs: OrgOption[];
  currentOrgId: string;
  userName: string;
  roles: string[];
  unread: number;
  theme: Theme;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-surface/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <OrgSwitcher orgs={orgs} currentId={currentOrgId} />
        <span className="hidden gap-1 sm:flex">
          {roles.map((r) => (
            <span key={r} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {r}
            </span>
          ))}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <SearchPalette />
        <ThemeToggle theme={theme} />
        <LocaleSwitcher />
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {initials(userName)}
          </div>
          <span className="hidden text-sm font-medium text-fg sm:block">{userName}</span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
