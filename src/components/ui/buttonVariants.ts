/**
 * Shared class contract for Button and ButtonLink.
 *
 * Both primitives render a single interactive element, so they must resolve to
 * identical interaction behaviour: the same focus strategy (Stage 1
 * `.focus-ring`), the same active treatment, and the same minimum tap target.
 */
export const BUTTON_BASE_CLASS =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium ' +
  'transition-[background-color,border-color,color,transform] duration-base ' +
  'active:translate-y-px focus-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  // --text-on-accent, not text-white: white on --accent measured 2.4:1.
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary:
    'border border-control bg-elevated text-ink hover:bg-interactive',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
};