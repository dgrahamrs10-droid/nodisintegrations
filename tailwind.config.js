/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  corePlugins: {
    // Keep our own resets in globals.css — don't let Tailwind override them
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)'],
        body:    ['var(--font-body)'],
      },
      colors: {
        orange: '#ff6b35',
        amber:  '#f7931e',
      },
      screens: {
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};
