/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0d14',
          card: 'rgba(16, 22, 34, 0.75)',
          border: '#1e293b',
          neonCyan: '#00f3ff',
          neonEmerald: '#10b981',
          neonAmber: '#f59e0b',
          neonRed: '#ef4444'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
