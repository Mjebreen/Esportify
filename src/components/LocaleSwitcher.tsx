'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocale } from '@/server/i18n-actions';
import type { Locale } from '@/i18n/request';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 text-xs font-medium" aria-label="Language">
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo('en')}
        className={`rounded-md px-2 py-1 transition-colors ${locale === 'en' ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
      >
        EN
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo('ar')}
        className={`rounded-md px-2 py-1 transition-colors ${locale === 'ar' ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
      >
        ع
      </button>
    </div>
  );
}
