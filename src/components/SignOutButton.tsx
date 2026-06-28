import { LogOut } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { signOutAction } from '@/server/auth/actions';

export async function SignOutButton() {
  const t = await getTranslations('common');
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        aria-label={t('signOut')}
        title={t('signOut')}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );
}
