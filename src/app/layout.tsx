import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dirFor } from '@/i18n/request';
import { THEME_COOKIE } from '@/server/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Esportify',
  description: 'Esports org operations platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Esports-leaning dark theme by default; toggleable per user.
  const theme = (await cookies()).get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';

  return (
    <html lang={locale} dir={dirFor(locale)} className={theme === 'dark' ? 'dark' : undefined}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
