import type { Config } from 'tailwindcss';

// RTL strategy: never use physical-direction utilities (ml-/mr-/pl-/pr-/left-/right-/text-left...).
// Tailwind's logical utilities (ms-/me-/ps-/pe-/start-/end-/text-start...) flip automatically with
// <html dir="rtl">. Dark mode is class-based — the .dark class on <html> swaps the CSS-var palette.
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        md: '0 4px 12px -2px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
