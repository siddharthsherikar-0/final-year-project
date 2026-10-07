import type { ModelFormat } from '@/types';

export function isValidModelFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'glb' || ext === 'gltf';
}

export function getFileExtension(filename: string): ModelFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb') return 'glb';
  if (ext === 'gltf') return 'gltf';
  return null;
}

export function isFileSizeValid(bytes: number, maxMB: number): boolean {
  return bytes <= maxMB * 1024 * 1024;
}
