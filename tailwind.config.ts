import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        unite: {
          bg: '#080D17',
          surface: '#0E1523',
          elevated: '#141D2D',
          card: '#192438',
          blue: '#2563EB',
          'blue-hover': '#3B82F6',
          cyan: '#22D3EE',
          teal: '#14B8A6',
          text: '#F8FAFC',
          'text-secondary': '#94A3B8',
          'text-muted': '#64748B',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'unite-glow': '0 0 28px rgba(37, 99, 235, 0.35)',
        'unite-cyan-glow': '0 0 36px rgba(34, 211, 238, 0.18)',
        'unite-panel': '0 12px 32px rgba(2, 6, 23, 0.55)',
      },
    },
  },
  plugins: [],
};

export default config;

