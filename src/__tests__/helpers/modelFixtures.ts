import type { ModelMetadata } from '@/types';

export function makeModel(
  id: string,
  overrides: Partial<ModelMetadata> = {},
): ModelMetadata {
  return {
    id,
    name: `Model ${id}`,
    description: `Description ${id}`,
    category: 'other',
    format: 'glb',
    fileUrl: `/models/${id}.glb`,
    thumbnailUrl: '',
    fileSize: 1024,
    hasTextures: false,
    hasAnimations: false,
    tags: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}
