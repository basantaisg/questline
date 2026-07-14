import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#06030e',
          900: '#0b0618',
          800: '#120a24',
          700: '#1b1036',
        },
        neon: {
          cyan: '#38e1ff',
          magenta: '#ff4ecd',
          lime: '#a8ff3e',
          amber: '#ffb84d',
        },
        ink: {
          DEFAULT: '#f4f1ff',
          muted: '#9a93b5',
          faint: '#6b6488',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 24px -4px rgba(56,225,255,0.5)',
        'neon-magenta': '0 0 24px -4px rgba(255,78,205,0.5)',
        'neon-lime': '0 0 24px -4px rgba(168,255,62,0.5)',
        glass: '0 8px 32px rgba(0,0,0,0.45)',
      },
      keyframes: {
        crackle: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '25%': { opacity: '0.85', filter: 'brightness(1.6)' },
          '50%': { opacity: '1', filter: 'brightness(1.2)' },
          '75%': { opacity: '0.9', filter: 'brightness(1.8)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px -2px rgba(56,225,255,0.4)' },
          '50%': { boxShadow: '0 0 32px 2px rgba(56,225,255,0.7)' },
        },
        drift: {
          '0%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-18px) rotate(3deg)' },
          '100%': { transform: 'translateY(0) rotate(0deg)' },
        },
      },
      animation: {
        crackle: 'crackle 0.9s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        drift: 'drift 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
