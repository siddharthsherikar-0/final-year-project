import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    const input = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder-ink-faint transition-colors duration-fast focus-ring ${
          error ? 'border-danger' : 'border-control'
        } ${className}`}
        {...props}
      />
    );

    if (!label && !error) return input;

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            {label}
          </label>
        )}
        {input}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
