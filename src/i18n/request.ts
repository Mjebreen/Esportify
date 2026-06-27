import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function dirFor(locale: string): 'rtl' | 'ltr' {
  return locale.startsWith('ar') ? 'rtl' : 'ltr';
}

/**
 * next-intl WITHOUT path-based routing: locale comes from a cookie (set by the
 * locale switcher / user preference), so we avoid an extra edge middleware and a
 * `[locale]` route segment. RTL is driven from <html dir> in the root layout.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
