import type { ReactNode } from 'react';
import type { ModelMetadata } from '@/types';
import { ModelCard } from './ModelCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CARD_GRID_CLASS } from '@/components/ui/cardLayout';

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
    <div className={CARD_GRID_CLASS}>
      {models.map((model) => (
        <ModelCard key={model.id} model={model} />
      ))}
    </div>
  );
}
