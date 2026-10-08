import type { ModelMetadata } from '@/types';
import { ModelCard } from '@/components/gallery/ModelCard';

interface MostFavoritedProps {
  models: ModelMetadata[];
}

const MAX_FEATURED = 4;

export function MostFavorited({ models }: MostFavoritedProps) {
  const ranked = models
    .filter((m) => (m.favoriteCount ?? 0) > 0)
    .sort((a, b) => (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0))
    .slice(0, MAX_FEATURED);

  if (ranked.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      aria-label="Most favorited"
    >
      <div className="mb-6">
        <h2 className="font-display text-title font-semibold text-ink">
          Most favorited
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Ranked by real favorite counts from the gallery.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ranked.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </section>
  );
}
