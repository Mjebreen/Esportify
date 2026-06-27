'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  const forbidden = error.message.startsWith('Forbidden');
  return (
    <div className="mx-auto mt-20 max-w-md rounded-xl border bg-surface p-8 text-center">
      <h2 className="text-lg font-semibold text-fg">
        {forbidden ? t('errors.forbidden') : t('errors.unexpected')}
      </h2>
      <div className="mt-5 flex justify-center gap-3">
        <button onClick={reset} className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg">
          {t('common.cancel')}
        </button>
        <Link href="/dashboard" className="rounded-md bg-accent px-3 py-1.5 text-sm text-white">
          {t('nav.dashboard')}
        </Link>
      </div>
    </div>
  );
}
