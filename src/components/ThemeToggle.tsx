'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Moon, Sun } from 'lucide-react';
import { setTheme } from '@/server/theme-actions';
import type { Theme } from '@/server/theme';

export function ThemeToggle({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setTheme(next);
          router.refresh();
        })
      }
      className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
