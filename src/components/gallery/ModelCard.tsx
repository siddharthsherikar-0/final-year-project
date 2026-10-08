import { Link } from 'react-router-dom';
import type { ModelMetadata } from '@/types';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { categoryLabel } from '@/config/categories';
import { formatFileSize } from '@/utils/format';
import { FavoriteButton } from './FavoriteButton';
import { ModelMedia } from './ModelMedia';

interface ModelCardProps {
  model: ModelMetadata;
  /** `feature` gives a single model more room (My Models, dashboard spotlight). */
  variant?: 'default' | 'feature';
}

/**
 * Model-first card.
 *
 * Hierarchy: the rendered asset dominates, then the name, then a short
 * description, then a quiet technical line. Metadata never competes with the
 * preview, and gold is spent only on the favorite state.
 *
 * Layer order: surface (A) -> link+content (B) -> favorite (C). The surface is
 * a wrapper rather than the link so the favorite control stays a sibling and no
 * interactive element is ever nested inside the card link.
 */
export function ModelCard({ model, variant = 'default' }: ModelCardProps) {
  const feature = variant === 'feature';

  return (
    <SurfaceCard
      interactive
      data-testid="model-card"
      className="group overflow-hidden"
    >
      <Link
        to={`/model/${model.id}`}
        className="block rounded-card focus-ring"
      >
        <ModelMedia
          thumbnailUrl={model.thumbnailUrl}
          category={model.category}
          format={model.format}
          // The link already announces the model name, so the preview stays
          // decorative instead of duplicating it for screen readers.
          alt={false}
          className={feature ? 'aspect-[16/10] w-full' : 'aspect-[4/3] w-full'}
        />

        <div className={feature ? 'px-5 py-5 sm:px-6' : 'px-4 py-4'}>
          <h3
            className={
              feature
                ? 'font-display text-xl font-semibold leading-snug text-ink'
                : 'font-display text-[15px] font-semibold leading-snug text-ink'
            }
          >
            {model.name}
          </h3>

          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {model.description}
          </p>

          {/* Technical line: monospace for facts, never for names or prose. */}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            <span>{model.format}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate normal-case tracking-normal">
              {categoryLabel(model.category)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(model.fileSize)}</span>

            {(model.favoriteCount ?? 0) > 0 && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums normal-case tracking-normal">
                <svg
                  className="h-3 w-3 text-accent"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  {/* Five-point star, 20x20. The arc flags are written as
                      separate tokens (`a 1 1 0 0 0 -.364 1.118`): the
                      minified form `a1 1 00-.364 ...` is parsed as a
                      malformed arc and the browser rejects the attribute. */}
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 0 0 .95.69h4.162c.969 0 1.371 1.24 .588 1.81l-3.367 2.446a1 1 0 0 0-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.539 1.118l-3.366-2.446a1 1 0 0 0-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 0 0-.364-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 0 0 .95-.69l1.286-3.958z" />
                </svg>
                {model.favoriteCount}
                <span className="sr-only">favorites</span>
              </span>
            )}
          </p>
        </div>
      </Link>

      {/* Favorite overlay — sibling of the link, own surface for contrast. */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <FavoriteButton modelId={model.id} />
      </div>
    </SurfaceCard>
  );
}