/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          700: '#27272a',
          800: '#18181b',
          850: '#121214',
          900: '#0e0e11',
          950: '#09090b',
        },
        aurora: {
          indigo: '#4f46e5',
          violet: '#7c3aed',
          amber:  '#f59e0b',
          sky:    '#0ea5e9',
          rose:   '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow':  'spin 3s linear infinite',
        'blob-drift': 'blobDrift 20s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blobDrift: {
          '0%':   { transform: 'translate(0,0) scale(1)' },
          '33%':  { transform: 'translate(4%,3%) scale(1.06)' },
          '66%':  { transform: 'translate(-3%,5%) scale(0.94)' },
          '100%': { transform: 'translate(5%,-2%) scale(1.08)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};