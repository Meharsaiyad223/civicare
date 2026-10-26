/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101a28',
        panel: '#172435',
        mint: '#54d6b2',
        canvas: '#f5f7f5',
      },
      boxShadow: { soft: '0 18px 48px rgba(20, 39, 54, .08)' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
