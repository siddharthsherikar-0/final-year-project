import type { HTMLAttributes, ReactNode } from 'react';

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Clickable cards (a link/button wrapped by the surface) get a restrained
   * hover elevation and a 1px press. Static surfaces (stat tiles, skeletons)
   * stay completely still.
   */
  interactive?: boolean;
}

/**
 * The single card surface in the product.
 *
 * Obsidian Studio card geometry:
 * - 12px radius (rounded-card), never the oversized "floating app" radius
 * - quiet --surface fill separated by a --border-hairline, no resting shadow
 * - elevation appears only on hover, so a grid of 12 cards is not 12 black halos
 */
const SURFACE_CLASS =
  'relative block rounded-card border border-line bg-surface';

const INTERACTIVE_CLASS =
  'transition-[border-color,box-shadow,transform] duration-base ' +
  'hover:border-accent/40 hover:shadow-card active:translate-y-px ' +
  'motion-reduce:transition-none';

export function SurfaceCard({
  children,
  className = '',
  interactive = false,
  ...rest
}: SurfaceCardProps) {
  return (
    <div
      className={`${SURFACE_CLASS} ${interactive ? INTERACTIVE_CLASS : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}