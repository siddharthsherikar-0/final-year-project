import type { ModelMetadata } from '@/types';
import { useModelStore } from '@/stores/useModelStore';
import { useRecentStore } from '@/stores/useRecentStore';
import { ModelCard } from '@/components/gallery/ModelCard';

export function RecentlyViewed() {
  const ids = useRecentStore((s) => s.ids);
  const models = useModelStore((s) => s.models);

  if (ids.length === 0) return null;

  const resolved = ids
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelMetadata => Boolean(m));

  if (resolved.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8"
      aria-label="Recently viewed"
    >
      <div className="mb-6">
        <h2 className="font-display text-title font-semibold text-ink">
          Recently viewed
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Jump back into the models you explored.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {resolved.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </section>
  );
}
