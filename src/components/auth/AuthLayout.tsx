import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/layout/BrandMark';
import { APP_NAME } from '@/config/constants';

/**
 * Auth layout.
 *
 * Login and register were already clean, but they read as a generic form. The
 * framing now states what the product is and what it works with: the brand
 * mark, one line of positioning, and the studio's technical vocabulary in mono
 * type. No marketing illustration and no extra network request.
 */
interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

const STUDIO_FACTS = ['GLB · GLTF', 'WebGL', 'Draco', 'Local previews'];

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="mx-auto grid min-h-[70vh] w-full max-w-5xl grid-cols-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <section className="order-2 lg:order-1">
        <div className="relative overflow-hidden rounded-panel border border-line bg-surface p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="studio-grid pointer-events-none absolute inset-0 opacity-40"
          />

          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
              Obsidian 3D Studio
            </p>
            <h1 className="mt-3 font-display text-title font-bold text-ink">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
              {description}
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5">
              {STUDIO_FACTS.map((fact) => (
                <li
                  key={fact}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint"
                >
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="order-1 lg:order-2">
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <div className="mb-7 flex flex-col items-start">
            <BrandMark size="sm" />
          </div>

          {children}

          <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          <Link
            to="/"
            className="rounded-sm underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-ring"
          >
            Continue browsing the gallery
          </Link>
        </p>
      </section>
    </div>
  );
}

export function AuthCardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>
  );
}

export function AuthProductName() {
  return <span className="sr-only">{APP_NAME}</span>;
}