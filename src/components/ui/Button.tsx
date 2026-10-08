import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  BUTTON_BASE_CLASS,
  buttonVariantClasses,
  type ButtonVariant,
} from './buttonVariants';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE_CLASS} ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}