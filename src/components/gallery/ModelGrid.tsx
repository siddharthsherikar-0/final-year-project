import type { ModelMetadata } from '@/types';
import { ModelCard } from './ModelCard';

interface ModelGridProps {
  models: ModelMetadata[];
}

export function ModelGrid({ models }: ModelGridProps) {
  if (models.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">No models found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {models.map((model) => (
        <ModelCard key={model.id} model={model} />
      ))}
    </div>
  );
}
