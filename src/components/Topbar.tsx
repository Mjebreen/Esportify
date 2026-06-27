import { LocaleSwitcher } from './LocaleSwitcher';
import { SignOutButton } from './SignOutButton';

export function Topbar({ orgName, userName, roles }: { orgName: string; userName: string; roles: string[] }) {
  return (
    <header className="flex items-center justify-between border-b bg-surface px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-fg">{orgName}</span>
        <span className="hidden gap-1 sm:flex">
          {roles.map((r) => (
            <span key={r} className="rounded bg-bg px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
              {r}
            </span>
          ))}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <LocaleSwitcher />
        <span className="text-sm text-muted">{userName}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
