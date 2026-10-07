import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0C',
        surface: '#131417',
        elevated: '#1B1D22',
        line: '#2A2D34',
        ink: {
          DEFAULT: '#F4F5F7',
          muted: '#A3A9B4',
          faint: '#7B818C',
        },
        accent: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#60A5FA',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        title: ['clamp(1.75rem, 3vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        subtitle: ['1.125rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        card: '12px',
        panel: '16px',
      },
      boxShadow: {
        lift: '0 12px 40px rgba(0, 0, 0, 0.45)',
        card: '0 4px 20px rgba(0, 0, 0, 0.25)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [],
};

export default config;
