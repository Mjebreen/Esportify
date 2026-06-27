import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-fg">{t('app.name')}</h1>
            <p className="text-sm text-muted">{t('login.title')}</p>
          </div>
          <LocaleSwitcher />
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted">{t('login.demoHint')}</p>
      </div>
    </div>
  );
}
