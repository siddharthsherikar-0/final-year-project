import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';

export interface HeroStats {
  total: number;
  categories: number;
  formats: number;
}

interface HeroProps {
  stats: HeroStats;
  isLoading: boolean;
}

export const primaryCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-base hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export const secondaryCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-elevated px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-base hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-faint focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export function Hero({ stats, isLoading }: HeroProps) {
  const items = [
    { label: 'Models', value: stats.total },
    { label: 'Categories', value: stats.categories },
    { label: 'Formats', value: stats.formats },
  ];

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[110px]" />
        <div className="studio-grid absolute inset-0 opacity-50" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <p className="flex items-center gap-2 text-sm font-medium text-accent-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-soft" />
          Interactive 3D asset studio
        </p>

        <h1 className="mt-5 max-w-3xl font-display text-display font-bold text-ink">
          Explore 3D models,{' '}
          <span className="text-accent-soft">live in your browser</span>.
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Load GLB and GLTF assets in a real-time WebGL viewer — orbit, zoom,
          and inspect every detail without downloading a thing.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#gallery" className={primaryCtaClass}>
            Browse models
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </a>
          <Link to="/upload" className={secondaryCtaClass}>
            Upload a model
          </Link>
        </div>

        <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-6">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                {item.label}
              </dt>
              <dd className="mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  <span className="font-display text-title font-semibold text-ink">
                    {item.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
