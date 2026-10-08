import { useMemo, type ReactNode } from 'react';
import type { ModelMetadata } from '@/types';
import { useFilterStore } from '@/stores/useFilterStore';
import { ModelGrid } from './ModelGrid';
import { GallerySkeleton } from './GallerySkeleton';

interface ModelGalleryProps {
  models: ModelMetadata[];
  isLoading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function ModelGallery({
  models,
  isLoading,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ModelGalleryProps) {
  const sortBy = useFilterStore((s) => s.sortBy);
  const sortOrder = useFilterStore((s) => s.sortOrder);

  const sortedModels = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...models].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return a.createdAt.localeCompare(b.createdAt) * dir;
        case 'size':
          return (a.fileSize - b.fileSize) * dir;
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });
  }, [models, sortBy, sortOrder]);

  if (isLoading) {
    return <GallerySkeleton />;
  }

  return (
    <ModelGrid
      models={sortedModels}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
    />
  );
}
