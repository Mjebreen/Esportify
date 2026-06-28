'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
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
    return <span className="text-sm font-medium text-fg">{only?.name ?? ''}</span>;
  }

  return (
    <select
      value={currentId}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const res = await switchOrg(e.target.value);
          if (res.ok) router.refresh();
        })
      }
      className="rounded-md border bg-surface px-2 py-1 text-sm font-medium text-fg"
      aria-label="Organization"
    >
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
