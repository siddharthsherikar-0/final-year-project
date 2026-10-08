import { Link } from 'react-router-dom';
import { isNavItemActive, type NavItem } from '@/config/navigation';

interface NavItemLinkProps {
  item: NavItem;
  pathname: string;
  variant?: 'desktop' | 'menu' | 'footer';
  onNavigate?: () => void;
  className?: string;
}

/**
 * One navigation link pattern for the desktop bar, the mobile sheet and the
 * footer. Active state is resolved from navigation.ts, so nested routes keep
 * the right item highlighted and `aria-current` stays truthful.
 *
 * Active styling pairs color with an indicator (a gold rail on desktop, a gold
 * left border in the sheet) so it never depends on color alone.
 */
const VARIANT_CLASS = {
  desktop:
    'relative inline-flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium ' +
    'transition-[background-color,color,transform] duration-fast active:translate-y-px focus-ring motion-reduce:transition-none ' +
    'text-ink-muted hover:bg-interactive hover:text-ink',
  menu:
    'flex min-h-[44px] w-full items-center rounded-md border-l-2 border-l-transparent px-3 py-2.5 text-sm font-medium ' +
    'transition-[background-color,color,transform] duration-fast active:translate-y-px focus-ring motion-reduce:transition-none ' +
    'text-ink-muted hover:bg-elevated hover:text-ink',
  footer:
    'inline-flex min-h-[32px] items-center rounded-sm py-1 text-sm ' +
    'transition-colors duration-fast hover:text-ink focus-ring',
} as const;

const ACTIVE_CLASS = {
  desktop: 'bg-interactive text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent',
  menu: 'border-accent bg-accent-subtle text-accent',
  footer: 'text-ink',
} as const;

export function NavItemLink({
  item,
  pathname,
  variant = 'desktop',
  onNavigate,
  className = '',
}: NavItemLinkProps) {
  const active = isNavItemActive(item, pathname);

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-nav-id={item.id}
      data-active={active ? 'true' : undefined}
      className={`${VARIANT_CLASS[variant]} ${active ? ACTIVE_CLASS[variant] : ''} ${className}`}
    >
      {item.label}
    </Link>
  );
}
