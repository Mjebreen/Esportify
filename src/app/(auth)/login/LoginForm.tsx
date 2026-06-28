'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { authenticate, type LoginState } from './actions';

export function LoginForm() {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState<LoginState, FormData>(authenticate, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-fg">{t('email')}</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-fg">{t('password')}</span>
        <input name="password" type="password" required autoComplete="current-password" className="field" />
      </label>
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{t('error')}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primary mt-1 w-full py-2.5">
        {t('submit')}
      </button>
    </form>
  );
}
