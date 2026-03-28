import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nova paleta light
        brand: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#2EA3E6', // Azul-ciano principal
          600: '#1890ff',
          700: '#096dd9',
          800: '#0050b3',
          900: '#003a8c',
        },
        purple: {
          50: '#f5f0ff',
          100: '#ead6ff',
          200: '#d9b8ff',
          300: '#c599ff',
          400: '#b37aff',
          500: '#7D3C98', // Roxo secundário
          600: '#6b2d85',
          700: '#591f72',
          800: '#47135e',
          900: '#350a4a',
        },
        gray: {
          50: '#F7F8FA', // Fundo principal
          100: '#F1F3F5',
          200: '#E5E7EB', // Bordas
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280', // Texto secundário
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937', // Texto principal
          900: '#111827',
        },
        // Mantém cores de alerta
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        // Mantém secondary e dark para compatibilidade
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8B5CF6',
          600: '#7c3aed',
          700: '#6D28D9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-in forwards',
      },
    },
  },
  plugins: [],
}
export default config
