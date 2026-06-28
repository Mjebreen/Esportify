// Plain module (NOT 'use server') — constants/types can live here and be imported
// by both server and client. The cookie-setting action lives in theme-actions.ts.
export const THEME_COOKIE = 'theme';
export type Theme = 'dark' | 'light';
