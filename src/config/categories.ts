import type { ModelCategory, ModelFormat } from '@/types';

export const CATEGORIES: { value: ModelCategory; label: string }[] = [
  { value: 'architecture', label: 'Architecture' },
  { value: 'characters', label: 'Characters' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'nature', label: 'Nature' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'other', label: 'Other' },
];

export const FORMATS: { value: ModelFormat; label: string }[] = [
  { value: 'glb', label: 'GLB' },
  { value: 'gltf', label: 'GLTF' },
];

export function categoryLabel(value: ModelCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
