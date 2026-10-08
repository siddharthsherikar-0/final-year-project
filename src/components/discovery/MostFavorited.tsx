import type { ModelMetadata } from '@/types';
import { ModelCard } from '@/components/gallery/ModelCard';
import { SectionHeader } from '@/components/studio/PageHeader';
import { railGridClass } from '@/components/ui/cardLayout';

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
      className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8"
      aria-label="Most favorited"
    >
      <SectionHeader
        title="Most saved in the gallery"
        description="Ranked by real favorite counts, not promoted placements."
      />
      <div className={railGridClass(ranked.length)}>
        {ranked.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </section>
  );
}

