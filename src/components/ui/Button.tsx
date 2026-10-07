import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

const variantClasses = {
  primary:
    'bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent',
  secondary:
    'border border-line bg-elevated text-ink hover:bg-line focus-visible:ring-ink-faint',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink focus-visible:ring-ink-faint',
};

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
