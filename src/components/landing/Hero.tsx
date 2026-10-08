import { Link } from 'react-router-dom';
import type { ModelMetadata } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { ModelMedia } from '@/components/gallery/ModelMedia';

export interface HeroStats {
  total: number;
  categories: number;
  formats: number;
}

interface HeroProps {
  stats: HeroStats;
  isLoading: boolean;
  /** Real gallery assets shown as the hero's visual anchor. */
  featured: ModelMetadata[];
}

export const primaryCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors duration-base hover:bg-accent-hover focus-ring';

export const secondaryCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-elevated px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-base hover:bg-interactive focus-ring';

export function Hero({ stats, isLoading, featured }: HeroProps) {
  const items = [
    { label: 'Models', value: stats.total },
    { label: 'Categories', value: stats.categories },
    { label: 'Formats', value: stats.formats },
  ];

  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Studio texture only - no glow blobs, no gradients. */}
      <div
        aria-hidden="true"
        className="studio-grid pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
              Obsidian 3D Studio
            </p>

            <h1 className="mt-4 font-display text-display font-bold text-ink">
              A studio for 3D assets, not a table of records.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Every model below is rendered from the actual GLB file, so you can
              recognise an asset before you read a single specification. Open
              any of them in the real-time WebGL viewer to orbit, zoom and
              inspect the details.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#gallery" className={primaryCtaClass}>
                Browse the gallery
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

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {items.map((item) => (
                <div key={item.label} className="flex items-baseline gap-2">
                  <dt className="text-xs uppercase tracking-wider text-ink-faint">
                    {item.label}
                  </dt>
                  <dd>
                    {isLoading ? (
                      <Skeleton className="h-6 w-10" />
                    ) : (
                      <span className="font-mono text-lg font-medium tabular-nums text-ink">
                        {item.value}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The product shows its assets instead of abstract decoration.
              Three tiles: one wide studio shot plus two squares. A taller
              mosaic pushed the hero past a screen and left the copy floating
              in empty space. */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-2 gap-3">
              {featured.slice(0, 3).map((model, index) => (
                <Link
                  key={model.id}
                  to={`/model/${model.id}`}
                  aria-label={`${model.name} — open model`}
                  className={`group relative block overflow-hidden rounded-card border border-line bg-bg focus-ring ${
                    index === 0 ? 'col-span-2' : ''
                  }`}
                >
                  <ModelMedia
                    thumbnailUrl={model.thumbnailUrl}
                    category={model.category}
                    format={model.format}
                    alt={false}
                    className={index === 0 ? 'aspect-[16/9] w-full' : 'aspect-[4/3] w-full'}
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-bg/95 to-transparent px-3 pb-2 pt-6 text-left">
                    <span className="truncate text-xs font-medium text-ink">
                      {model.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      {model.format}
                    </span>
                  </span>
                </Link>
              ))}

              {isLoading &&
                [0, 1, 2].map((i) => (
                  <Skeleton
                    key={i}
                    className={i === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'}
                  />
                ))}
            </div>

            {!isLoading && featured.length === 0 && (
              <p className="rounded-card border border-dashed border-control/50 px-5 py-10 text-center text-sm text-ink-muted">
                No models published yet. Upload the first asset to fill the
                studio.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}