/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#10b981',
          light: '#34d399',
          dark: '#059669',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#18181b',
          elevated: '#fafafa',
          'elevated-dark': '#27272a',
        },
        ink: {
          DEFAULT: '#18181b',
          dark: '#f4f4f5',
          muted: '#a1a1aa',
          'muted-dark': '#71717a',
        },
        line: {
          DEFAULT: '#e4e4e7',
          dark: '#3f3f46',
        },
        status: {
          good: '#10b981',
          warn: '#f59e0b',
          bad: '#ef4444',
          info: '#3b82f6',
        },
      },
      borderRadius: {
        card: '16px',
        'card-sm': '12px',
      },
    },
  },
  plugins: [],
}
