/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        temple: {
          red: '#8B1A1A',
          'red-light': '#B22222',
          'red-dark': '#5C1010',
          gold: '#C4962A',
          'gold-light': '#E6B84A',
          cream: '#FFF8F0',
          'cream-dark': '#F5EDE0',
          dark: '#2D1A0A',
          muted: '#7A6050',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
