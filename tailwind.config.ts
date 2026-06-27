import type { Config } from 'tailwindcss';

// RTL strategy: we never use physical-direction utilities (ml-/mr-/pl-/pr-/left-/right-/text-left...).
// Tailwind's logical utilities (ms-/me-/ps-/pe-/start-/end-/text-start...) flip automatically with
// <html dir="rtl">. An ESLint rule (see .eslintrc) bans the physical variants so RTL can never break.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dense productivity-tool palette (Linear/Asana back-office feel).
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
