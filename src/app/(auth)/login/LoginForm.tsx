'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { authenticate, type LoginState } from './actions';

export function LoginForm() {
  const t = useTranslations('login');
  const [state, action, pending] = useActionState<LoginState, FormData>(authenticate, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('email')}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border bg-surface px-3 py-2 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('password')}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border bg-surface px-3 py-2 text-fg outline-none focus:border-accent"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{t('error')}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {t('submit')}
      </button>
    </form>
  );
}
