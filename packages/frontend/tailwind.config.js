/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // UNPANDA Brand Identity Tokens
        brand: {
          deep: '#344522',      // Deep Olive
          olive: '#556B2F',     // Olive Green
          sage: '#A3B18A',      // Sage Green
          canvas: '#F8F9F5',    // Off-White
          white: '#FFFFFF',     // Pure White
          border: '#DDE3D4',    // Olive Gray
          bamboo: '#C9A66B',    // Bamboo Tan
          charcoal: '#20251D',  // Charcoal
        },
        canvas: {
          DEFAULT: '#F8F9F5',
          subtle: '#EEF2E6',
          card: '#FFFFFF',
          border: '#DDE3D4',
        },
        ink: {
          DEFAULT: '#20251D',
          secondary: '#3E4739',
          muted: '#626E5B',
          faint: '#8E9C87',
        },
        accent: {
          50: '#F5F7F1',
          100: '#E7ECE0',
          200: '#D3DDC7',
          300: '#BAC9AA',
          400: '#A3B18A',
          500: '#758853',
          600: '#556B2F',
          700: '#435525',
          800: '#344522',
          900: '#253218',
        },
        status: {
          success: '#436B2B',
          warning: '#B8860B',
          danger: '#B91C1C',
          info: '#3B6E8C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
