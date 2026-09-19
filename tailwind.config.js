/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        printer: {
          paper: '#ffffff',
          border: '#cbd5e1',
          ink: '#0f172a',
          slot: '#1e293b'
        }
      },
      animation: {
        'scan-laser': 'scanLaser 2.4s ease-in-out infinite',
        'paper-feed': 'paperFeed 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shake': 'shake 0.4s ease-in-out',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'glimmer': 'glimmer 3s infinite',
      },
      keyframes: {
        scanLaser: {
          '0%, 100%': { top: '8%', opacity: '0.4' },
          '50%': { top: '88%', opacity: '0.95' },
        },
        paperFeed: {
          '0%': { transform: 'translateY(-35px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-7px)' },
          '40%, 80%': { transform: 'translateX(7px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        glimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      boxShadow: {
        'clean': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'printer-tear': '0 10px 15px -3px rgba(0, 0, 0, 0.07)',
      }
    },
  },
  plugins: [],
}
