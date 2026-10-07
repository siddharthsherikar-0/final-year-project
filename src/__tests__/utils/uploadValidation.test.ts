import { describe, it, expect } from 'vitest';
import { isValidModelFormat } from '@/utils/validation';

describe('upload validation', () => {
  it('accepts .glb files', () => {
    expect(isValidModelFormat('model.glb')).toBe(true);
  });

  it('accepts .gltf files', () => {
    expect(isValidModelFormat('model.gltf')).toBe(true);
  });

  it('rejects other formats', () => {
    expect(isValidModelFormat('model.obj')).toBe(false);
    expect(isValidModelFormat('model.fbx')).toBe(false);
    expect(isValidModelFormat('model.stl')).toBe(false);
  });

  it('rejects files with no extension', () => {
    expect(isValidModelFormat('model')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isValidModelFormat('MODEL.GLB')).toBe(true);
    expect(isValidModelFormat('Model.GlTf')).toBe(true);
  });
});
