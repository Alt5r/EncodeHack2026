import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: '#1a3a28',
        sky: '#1a0e06',
        ember: '#ffb347',
        fire: '#ff4500',
        burned: '#2a1a0a',
        firebreak: '#5a3a1a',
        village: '#d4845a',
        water: '#4fc3f7',
        terminal: '#0a0800',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
