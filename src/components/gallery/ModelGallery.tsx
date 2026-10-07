import { useMemo } from 'react';
import type { ModelMetadata } from '@/types';
import { ModelGrid } from './ModelGrid';
import { GallerySkeleton } from './GallerySkeleton';

interface ModelGalleryProps {
  models: ModelMetadata[];
  isLoading: boolean;
}

export function ModelGallery({ models, isLoading }: ModelGalleryProps) {
  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  if (isLoading) {
    return <GallerySkeleton />;
  }

  return <ModelGrid models={sortedModels} />;
}
