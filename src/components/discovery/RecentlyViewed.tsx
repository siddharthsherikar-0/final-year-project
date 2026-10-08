import type { ModelMetadata } from '@/types';
import { useModelStore } from '@/stores/useModelStore';
import { useRecentStore } from '@/stores/useRecentStore';
import { ModelCard } from '@/components/gallery/ModelCard';
import { SectionHeader } from '@/components/studio/PageHeader';
import { railGridClass } from '@/components/ui/cardLayout';

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
      <SectionHeader
        title="Recently viewed"
        description="Pick up where you left off in the studio."
      />
      <div className={railGridClass(resolved.length)}>
        {resolved.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </section>
  );
}
