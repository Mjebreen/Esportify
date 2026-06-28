'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Building2 } from 'lucide-react';
import { switchOrg } from '@/server/org/switch';

export interface OrgOption {
  id: string;
  name: string;
}

/** Org switcher — only rendered when the user belongs to more than one org. */
export function OrgSwitcher({ orgs, currentId }: { orgs: OrgOption[]; currentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (orgs.length < 2) {
    const only = orgs.find((o) => o.id === currentId);
    return (
      <span className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Building2 className="h-4 w-4 text-muted" />
        {only?.name ?? ''}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-surface px-2.5 py-1.5">
      <Building2 className="h-4 w-4 text-muted" />
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await switchOrg(e.target.value);
            if (res.ok) router.refresh();
          })
        }
        className="cursor-pointer bg-transparent text-sm font-semibold text-fg outline-none"
        aria-label="Organization"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
