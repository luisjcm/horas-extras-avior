/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        avior: {
          DEFAULT: '#830F10',
          bright: '#991C1F',
          bg: '#191A1C',
          panel: '#1B1C1E',
          field: '#26282B',
          nav: '#35383C',
          line: '#3F4348',
          well: '#16171A',
          light: '#F28B8D',
          ink: '#F1F2F4',
          muted: '#A3A8AF',
          silver: '#151618',
        },
      },
      backgroundImage: {
        metal: 'linear-gradient(180deg,#2D3034,#222427)',
        brushed: 'linear-gradient(90deg,#3A3E43 0%,#2B2E32 45%,#34373C 70%,#2A2D31 100%)',
        page: 'linear-gradient(180deg,#141517 0%,#0E0F10 100%)',
      },
      keyframes: {
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-6px)' },
          '40%,80%': { transform: 'translateX(6px)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        rise: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        pop: 'pop 0.3s ease-out',
        rise: 'rise 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
