import { APP_NAME } from '@/config/constants';

interface BrandMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = {
  sm: { mark: 'h-7 w-7', wordmark: 'text-sm' },
  md: { mark: 'h-6 w-6', wordmark: 'text-base' },
} as const;

/**
 * Product identity lockup. Reuses the exact mark already shipped in the
 * Header so every surface presents the same brand, without pulling the Header
 * (or its navigation) into non-layout pages.
 */
export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  const dimensions = SIZES[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        className={dimensions.mark}
        viewBox="0 0 32 32"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M16 5l9 5.2v10.4L16 25.8l-9-5.2V10.2L16 5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          className="text-ink"
        />
        <path
          d="M16 5v10.6M16 15.6l9 5M16 15.6l-9 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          className="text-accent-soft"
        />
      </svg>
      <span
        className={`font-display font-semibold tracking-tight text-ink ${dimensions.wordmark}`}
      >
        {APP_NAME}
      </span>
    </span>
  );
}