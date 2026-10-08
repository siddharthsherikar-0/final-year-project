import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (see src/index.css). Channel-based so the existing
        // `bg-accent/20` / `text-ink/10` / `border-danger/40` opacity modifiers
        // keep working. Existing token names are preserved so no component has
        // to change in this stage.
        bg: 'rgb(var(--canvas-ch) / <alpha-value>)',
        surface: 'rgb(var(--surface-ch) / <alpha-value>)',
        elevated: 'rgb(var(--elevated-ch) / <alpha-value>)',
        interactive: 'rgb(var(--interactive-ch) / <alpha-value>)',
        overlay: 'var(--overlay-panel)',
        scrim: 'var(--scrim)',
        line: 'rgb(var(--border-hairline-ch) / <alpha-value>)',
        control: 'rgb(var(--border-control-ch) / <alpha-value>)',
        strong: 'rgb(var(--border-strong-ch) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--text-primary-ch) / <alpha-value>)',
          muted: 'rgb(var(--text-secondary-ch) / <alpha-value>)',
          faint: 'rgb(var(--text-muted-ch) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--text-on-accent-ch) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent-ch) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-ch) / <alpha-value>)',
          muted: 'rgb(var(--accent-muted-ch) / <alpha-value>)',
          subtle: 'var(--accent-subtle)',
          // Legacy highlight-text role. Kept as a name so existing
          // `text-accent-soft` / `bg-accent-soft/10` utilities keep compiling;
          // it now resolves to the brighter gold used for accent text.
          soft: 'rgb(var(--accent-hover-ch) / <alpha-value>)',
        },
        info: 'rgb(var(--info-ch) / <alpha-value>)',
        success: 'rgb(var(--success-ch) / <alpha-value>)',
        warning: 'rgb(var(--warning-ch) / <alpha-value>)',
        danger: 'rgb(var(--error-ch) / <alpha-value>)',
        focus: 'rgb(var(--focus-ch) / <alpha-value>)',
        viewer: {
          bg: 'var(--viewer-bg)',
          grid: 'var(--viewer-grid)',
          axis: 'var(--viewer-axis)',
        },
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
