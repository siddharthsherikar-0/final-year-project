import { describe, it, expect } from 'vitest';
import { isValidModelFormat, getFileExtension, isFileSizeValid } from '@/utils/validation';

describe('isValidModelFormat', () => {
  it('accepts .glb files', () => {
    expect(isValidModelFormat('model.glb')).toBe(true);
  });

  it('accepts .gltf files', () => {
    expect(isValidModelFormat('model.gltf')).toBe(true);
  });

  it('rejects other formats', () => {
    expect(isValidModelFormat('model.obj')).toBe(false);
    expect(isValidModelFormat('model.fbx')).toBe(false);
    expect(isValidModelFormat('model')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isValidModelFormat('MODEL.GLB')).toBe(true);
    expect(isValidModelFormat('Model.GlTf')).toBe(true);
  });
});

describe('getFileExtension', () => {
  it('returns glb for .glb files', () => {
    expect(getFileExtension('model.glb')).toBe('glb');
  });

  it('returns gltf for .gltf files', () => {
    expect(getFileExtension('model.gltf')).toBe('gltf');
  });

  it('returns null for unsupported formats', () => {
    expect(getFileExtension('model.obj')).toBeNull();
  });
});

describe('isFileSizeValid', () => {
  it('accepts files under limit', () => {
    expect(isFileSizeValid(1024, 50)).toBe(true);
  });

  it('rejects files over limit', () => {
    expect(isFileSizeValid(51 * 1024 * 1024, 50)).toBe(false);
  });

  it('accepts files at exact limit', () => {
    expect(isFileSizeValid(50 * 1024 * 1024, 50)).toBe(true);
  });
});
