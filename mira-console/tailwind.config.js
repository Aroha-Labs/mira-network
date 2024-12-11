/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundColor: {
        'slate-750': '#273344', // Custom intermediate shade
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
