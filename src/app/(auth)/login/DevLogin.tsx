'use client';

import { useState, useTransition } from 'react';
import {
  Camera,
  Gauge,
  Plane,
  ShieldCheck,
  Shirt,
  User,
  UserCog,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { quickLogin } from './quick-actions';

interface Account {
  role: string;
  label: string;
  email: string;
  desc: string;
  icon: LucideIcon;
}

const ACCOUNTS: Account[] = [
  { role: 'SUPER_ADMIN', label: 'Super Admin', email: 'superadmin@twisminds.gg', desc: 'Full access · everything in-org', icon: ShieldCheck },
  { role: 'IT', label: 'IT', email: 'it@twisminds.gg', desc: 'Provisioning · module toggles', icon: Wrench },
  { role: 'LEADERSHIP', label: 'Leadership', email: 'leadership@twisminds.gg', desc: 'Read-across-all · assign tasks', icon: Gauge },
  { role: 'MANAGER', label: 'Manager', email: 'manager@twisminds.gg', desc: 'Owns a roster · player CRUD', icon: UserCog },
  { role: 'PLAYER', label: 'Player', email: 'player@twisminds.gg', desc: 'Self-service · own data only', icon: User },
  { role: 'MARCOM', label: 'Marcom', email: 'marcom@twisminds.gg', desc: 'Media library · tournament calendar', icon: Camera },
  { role: 'AVIATION', label: 'Aviation', email: 'aviation@twisminds.gg', desc: 'Travel · publish flight options', icon: Plane },
  { role: 'MERCH', label: 'Merch', email: 'merch@twisminds.gg', desc: 'Sizing · jersey entitlements', icon: Shirt },
];

export function DevLogin() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(account: Account) {
    setError(null);
    setBusy(account.email);
    startTransition(async () => {
      const res = await quickLogin(account.email);
      if (res?.error) {
        setError(res.error);
        setBusy(null);
      }
    });
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">Choose an account type to sign in (testing):</p>
      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-2.5">
        {ACCOUNTS.map((a) => {
          const Icon = a.icon;
          const isBusy = busy === a.email;
          return (
            <button
              key={a.role}
              type="button"
              disabled={pending}
              onClick={() => pick(a)}
              className="group flex flex-col gap-1 rounded-xl border bg-surface p-3 text-start transition-colors hover:border-accent/40 hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-fg">{a.label}</span>
              </span>
              <span className="text-[11px] leading-tight text-muted">{isBusy ? 'Signing in…' : a.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
