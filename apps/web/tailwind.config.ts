import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
        },
        success: {
          100: 'var(--color-success-100)',
          600: 'var(--color-success-600)',
        },
        danger: {
          100: 'var(--color-danger-100)',
          600: 'var(--color-danger-600)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        border: 'var(--color-border)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        yellow: {
          50: 'var(--color-yellow-50)',
          400: 'var(--color-yellow-400)',
        },
        gray: {
          50: 'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          300: 'var(--color-gray-300)',
        },
        orange: {
          50: 'var(--color-orange-50)',
          300: 'var(--color-orange-300)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '8': '8px',
        '12': '12px',
      },
      fontSize: {
        body: ['16px', { lineHeight: '24px' }],
        title: ['28px', { lineHeight: '36px' }],
        label: ['14px', { lineHeight: '20px' }],
      },
    },
  },
  plugins: [],
};

export default config;
