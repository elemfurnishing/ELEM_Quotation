/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F2FF',
          100: '#CCE5FF',
          200: '#99CCFF',
          300: '#66B2FF',
          400: '#3399FF',
          500: '#0066CC', // Main Blue
          600: '#0052A3',
          700: '#003D7A',
          800: '#002952',
          900: '#001429',
        },
        secondary: {
          50: '#E6F7EF',
          100: '#CCEFDF',
          200: '#99DFBF',
          300: '#66CF9F',
          400: '#33BF7F',
          500: '#00A651', // Main Green
          600: '#008541',
          700: '#006431',
          800: '#004221',
          900: '#002110',
        },
      },
    },
  },
  plugins: [
    // require('tailwind-scrollbar')({ nocompatible: true }),
  ],
};