import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BUTTON_BASE_CLASS,
  buttonVariantClasses,
  type ButtonVariant,
} from './buttonVariants';

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  onClick?: () => void;
}

/**
 * A router link that looks and behaves exactly like Button.
 *
 * Renders ONE interactive element. It replaces the `<Link><Button/></Link>`
 * pattern, which produced invalid HTML (an anchor nested inside an anchor) and
 * a nested-interactive accessibility defect.
 */
export function ButtonLink({
  to,
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={`${BUTTON_BASE_CLASS} ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}