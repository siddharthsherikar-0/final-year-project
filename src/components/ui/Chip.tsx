import type { ReactNode } from 'react';
import { Link, type To } from 'react-router-dom';

/**
 * Obsidian Studio chip geometry.
 *
 * 32px compact row (dense enough for an 8-chip filter bar, large enough to
 * hit comfortably). The hit area is extended with a pseudo-element so the
 * target is effectively ~40px tall without inflating the visual density.
 */
export const CHIP_BASE_CLASS =
  'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ' +
  'transition-[background-color,border-color,color] duration-fast ' +
  'after:absolute after:-inset-y-1 after:inset-x-0 after:content-[""] ' +
  'focus-ring motion-reduce:transition-none';

/** Neutral metadata state. */
export const CHIP_IDLE_CLASS =
  'relative border-control bg-elevated text-ink-muted ' +
  'hover:border-strong hover:bg-interactive hover:text-ink';

/**
 * Selected state: a restrained gold tint, never a saturated gold fill.
 * --accent on --accent-subtle measures 7.6:1, so the label stays readable.
 */
export const CHIP_SELECTED_CLASS =
  'relative border-accent/60 bg-accent-subtle text-accent hover:bg-accent/20';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  className?: string;
  /** Renders a router link (deep-linkable filters) instead of a button. */
  to?: To;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'true' | 'page';
  'aria-pressed'?: boolean;
}

export function Chip({
  children,
  selected = false,
  className = '',
  to,
  onClick,
  title,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
  'aria-pressed': ariaPressed,
}: ChipProps) {
  const classes = `${CHIP_BASE_CLASS} ${selected ? CHIP_SELECTED_CLASS : CHIP_IDLE_CLASS} ${className}`;

  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel} aria-current={ariaCurrent} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed ?? selected}
      title={title}
    >
      {children}
    </button>
  );
}
