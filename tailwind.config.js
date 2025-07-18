/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // You can add custom theme settings here
    },
  },
  plugins: [require('tailwindcss-animate')],
};
