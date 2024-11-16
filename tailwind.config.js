/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.{html,ejs,pug}",
    "./public/**/*.js"],
  theme: {
    extend: {},
  },
  plugins: [
    // Add custom scrollbar styling
    require('tailwind-scrollbar-hide'),
    // Or create your own custom scrollbar styles
    plugin(function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    })
  ],
}

