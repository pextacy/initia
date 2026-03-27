/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#edfdf8',
          100: '#d3f9ee',
          200: '#aaf1de',
          300: '#73e4c8',
          400: '#3acfaf',
          500: '#17b597',
          600: '#0d9179',
          700: '#0d7463',
          800: '#0f5c50',
          900: '#104c43',
        },
      },
    },
  },
  plugins: [],
}
