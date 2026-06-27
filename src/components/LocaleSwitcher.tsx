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
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo('en')}
        className={`rounded px-2 py-1 ${locale === 'en' ? 'bg-accent text-white' : 'text-muted hover:bg-bg'}`}
      >
        EN
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo('ar')}
        className={`rounded px-2 py-1 ${locale === 'ar' ? 'bg-accent text-white' : 'text-muted hover:bg-bg'}`}
      >
        ع
      </button>
    </div>
  );
}
