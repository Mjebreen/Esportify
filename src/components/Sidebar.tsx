'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SidebarNavItem {
  key: string;
  href: string;
  label: string;
}

export function Sidebar({ brand, tagline, items }: { brand: string; tagline: string; items: SidebarNavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-e bg-surface">
      <div className="border-b px-5 py-4">
        <div className="text-lg font-semibold text-fg">{brand}</div>
        <div className="text-xs text-muted">{tagline}</div>
      </div>
      <nav className="flex-1 p-3">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active ? 'bg-accent/10 font-medium text-accent' : 'text-fg hover:bg-bg'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
