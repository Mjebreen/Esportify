import { getTranslations } from 'next-intl/server';
import { Gamepad2 } from 'lucide-react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-40 start-0 end-0 mx-auto h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 end-10 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-indigo-400 text-white shadow-md">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-fg">{t('app.name')}</div>
              <div className="text-xs text-muted">{t('app.tagline')}</div>
            </div>
          </div>
          <LocaleSwitcher />
        </div>

        <div className="card p-6 shadow-md">
          <h1 className="text-base font-semibold text-fg">{t('login.title')}</h1>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">{t('login.demoHint')}</p>
      </div>
    </div>
  );
}
