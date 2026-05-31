import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        ink: {
          950: '#08080a',
          900: '#0b0b0f',
          800: '#131318',
          700: '#1b1b22',
        },
        accent: 'var(--accent)',
      },
      boxShadow: {
        panel: '0 1px 0 inset rgba(255,255,255,0.05), 0 24px 70px -28px rgba(0,0,0,0.85)',
        glow: '0 0 24px -4px var(--accent)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
