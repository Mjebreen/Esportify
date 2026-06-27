import { getTranslations } from 'next-intl/server';
import { signOutAction } from '@/server/auth/actions';

export async function SignOutButton() {
  const t = await getTranslations('common');
  return (
    <form action={signOutAction}>
      <button type="submit" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-bg">
        {t('signOut')}
      </button>
    </form>
  );
}
