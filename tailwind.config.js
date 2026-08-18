/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: ['bg-surface'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Fira Code"', '"JetBrains Mono"', 'monospace'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          soft: 'var(--color-primary-soft)',
          dark: 'var(--color-primary-dark)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          soft: 'var(--color-secondary-soft)',
        },
        cream: '#f7f5f0',
        sand: '#f0ebe3',
        charcoal: '#1a1a1a',
        stone: '#8a8a8a',
        background: {
          DEFAULT: 'var(--color-background)',
          dark: 'var(--color-background-dark)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          dark: 'var(--color-surface-dark)',
        },
        elevated: 'var(--color-elevated)',
        content: {
          DEFAULT: 'var(--color-content)',
          secondary: 'var(--color-content-secondary)',
          tertiary: 'var(--color-content-tertiary)',
        },
        coral: {
          DEFAULT: '#E8704A',
          light: '#F4A261',
        },
        violet: {
          soft: '#7C6BDB',
          light: '#A5B4FC',
        },
      },
      borderRadius: {
        'card': '20px',
        'modal': '24px',
        'button': '14px',
      },
      boxShadow: {
        'card-light': '0 4px 24px rgba(15, 23, 42, 0.06), 0 1px 4px rgba(15, 23, 42, 0.04)',
        'card-light-hover': '0 8px 32px rgba(15, 23, 42, 0.10), 0 2px 8px rgba(15, 23, 42, 0.06)',
        'modal-light': '0 24px 48px rgba(15, 23, 42, 0.12), 0 4px 16px rgba(15, 23, 42, 0.06)',
        'card-dark': '0 4px 24px rgba(0, 0, 0, 0.25), 0 1px 4px rgba(0, 0, 0, 0.15)',
        'card-dark-hover': '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.20)',
        'modal-dark': '0 24px 48px rgba(0, 0, 0, 0.40), 0 4px 16px rgba(0, 0, 0, 0.20)',
        'glow-primary': '0 0 20px rgba(129, 140, 248, 0.15)',
        'glow-accent': '0 0 20px rgba(196, 181, 253, 0.12)',
        'glow-secondary': '0 0 20px rgba(34, 211, 238, 0.18)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', fontWeight: '800' }],
        'title': ['1.5rem', { lineHeight: '1.3', fontWeight: '700' }],
        'body': ['15px', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
}
