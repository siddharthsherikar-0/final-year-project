import type { ReactNode } from 'react';
import type { ModelMetadata } from '@/types';
import { ModelCard } from './ModelCard';
import { EmptyState } from '@/components/ui/EmptyState';

interface ModelGridProps {
  models: ModelMetadata[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function ModelGrid({
  models,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ModelGridProps) {
  if (models.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? 'No models found'}
        description={
          emptyDescription ??
          'Try adjusting your search, or clear the active filters to see everything in the gallery.'
        }
        action={emptyAction}
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
