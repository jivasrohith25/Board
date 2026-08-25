/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#fad8ad',
          300: '#f6bd7b',
          400: '#f19b4a',
          500: '#ed8027',
          600: '#e06416',
          700: '#b94b11',
          800: '#943c13',
          900: '#773213',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        warm: {
          50: '#fdf8f3',
          100: '#faece6',
          200: '#f5d8cc',
          300: '#ebb7a3',
          400: '#e08e72',
          500: '#d4704e',
          600: '#c0593b',
          700: '#9d4630',
          800: '#803b2c',
          900: '#683328',
        }
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-lg': ['2.5rem', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'display-md': ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.015em' }],
        'display-sm': ['1.25rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.01em' }],
        'label': ['0.6875rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.06em' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(104, 51, 40, 0.04), 0 1px 2px rgba(104, 51, 40, 0.06)',
        'card-hover': '0 4px 12px rgba(104, 51, 40, 0.08), 0 2px 4px rgba(104, 51, 40, 0.04)',
        'elevated': '0 8px 24px rgba(104, 51, 40, 0.10), 0 2px 8px rgba(104, 51, 40, 0.06)',
        'glow-primary': '0 0 20px rgba(237, 128, 39, 0.15)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}