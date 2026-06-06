/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./syngnosia/index.html",
    "./syngnosia/app.js",
    "./syngnosia/data.js",
    "./chemistry/**/*.{html,js}",
    "./math/**/*.{html,js}",
    "./anatomy1/**/*.{html,js}",
    "./anatomy2/**/*.{html,js}",
    "./anatomy3/**/*.{html,js}",
    "./psychology/**/*.{html,js}"
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      gridTemplateColumns: {
        '18': 'repeat(18, minmax(0, 1fr))'
      },
      gridTemplateRows: {
        '7': 'repeat(7, minmax(0, 1fr))',
        '10': 'repeat(10, minmax(0, 1fr))'
      },
      colors: {
        slate: { 850: '#151e2e', 900: '#0f172a', 950: '#020617' },
        rose: { 650: '#e11d48', 750: '#be123c' },
        pink: { 650: '#db2777', 750: '#be185d' }
      }
    }
  },
  plugins: [],
}
