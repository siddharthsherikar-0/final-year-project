import type { ModelMetadata } from '@/types';

export const modelRegistry: ModelMetadata[] = [
  {
    id: 'sample-duck',
    name: 'Duck',
    description: 'A classic sample 3D duck model. Perfect for testing the viewer.',
    category: 'characters',
    format: 'glb',
    fileUrl: '/models/duck.glb',
    thumbnailUrl: '/models/duck-thumb.png',
    fileSize: 168000,
    vertexCount: 2399,
    triangleCount: 4212,
    hasTextures: true,
    hasAnimations: false,
    tags: ['sample', 'test', 'bird'],
    author: 'Khronos Group',
    license: 'CC0',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];
