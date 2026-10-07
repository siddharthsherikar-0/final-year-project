import type { ModelMetadata } from '@/types';
import { ModelCard } from './ModelCard';
import { EmptyState } from '@/components/ui/EmptyState';

interface ModelGridProps {
  models: ModelMetadata[];
}

export function ModelGrid({ models }: ModelGridProps) {
  if (models.length === 0) {
    return (
      <EmptyState
        title="No models found"
        description="Try adjusting your search, or clear the active filters to see everything in the gallery."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {models.map((model) => (
        <ModelCard key={model.id} model={model} />
      ))}
    </div>
  );
}
