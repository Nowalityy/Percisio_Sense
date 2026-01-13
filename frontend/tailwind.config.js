/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#050816',
        panel: '#0b1020',
        accent: '#38bdf8',
      },
    },
  },
  plugins: [],
};

