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
        paper: {
          DEFAULT: '#f5f0e8',
          dark: '#0d0d0b',
        },
        accent: {
          DEFAULT: '#c23a2b',
          light: '#e05a4a',
          dark: '#9a2e22',
        },
        surface: {
          DEFAULT: '#faf7f2',
          dark: '#1a1815',
          elevated: '#f5f0e8',
          'elevated-dark': '#141210',
        },
        ink: {
          DEFAULT: '#1a1a18',
          dark: '#d4a764',
          muted: '#7d7468',
          'muted-dark': '#8a7a60',
        },
        line: {
          DEFAULT: '#d4cdc0',
          dark: '#2a2520',
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
