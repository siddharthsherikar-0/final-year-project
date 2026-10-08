import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/ButtonLink';

/**
 * 404 in the studio's language: a wireframe viewport, a technical code, and one
 * obvious way back into the product. No illustration, no colour, no box.
 */
export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
      <div
        aria-hidden="true"
        className="studio-grid pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 120 96"
          className="mx-auto h-24 w-auto text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <rect x="8" y="8" width="104" height="80" rx="6" />
          <path d="M8 68 L38 42 L60 60 L78 46 L112 74" />
          <path d="M40 8 L60 30 L80 8" />
          <circle cx="88" cy="26" r="5" />
        </svg>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-ink-faint">
          Error 404
        </p>
        <h1 className="mt-3 font-display text-title font-bold text-ink">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
          That address is not part of the studio. Return to the gallery to keep
          browsing 3D assets.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink to="/">Return to gallery</ButtonLink>
          <Link
            to="/upload"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-base hover:text-ink focus-ring"
          >
            Publish a model
          </Link>
        </div>
      </div>
    </div>
  );
}