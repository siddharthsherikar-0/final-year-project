import { describe, it, expect } from 'vitest';
import { extractModelMetadata } from '@/utils/modelMetadata';
import {
  buildGlbBuffer,
  FIXTURE_STATS,
  makeGltfJson,
} from '../helpers/gltfFixture';

function gltfFile(json: unknown, name = 'model.gltf'): File {
  return new File([JSON.stringify(json)], name, { type: 'model/gltf+json' });
}

describe('extractModelMetadata', () => {
  it('reads real stats from a valid GLB', async () => {
    const file = new File([buildGlbBuffer(makeGltfJson())], 'fixture.glb');
    const result = await extractModelMetadata(file);
    expect(result).toEqual({ ok: true, stats: FIXTURE_STATS });
  });

  it('reads real stats from a valid GLTF', async () => {
    const result = await extractModelMetadata(gltfFile(makeGltfJson()));
    expect(result).toEqual({ ok: true, stats: FIXTURE_STATS });
  });

  it('reports zero stats for a valid glTF that declares no content', async () => {
    const result = await extractModelMetadata(
      gltfFile({ asset: { version: '2.0' } }),
    );
    expect(result).toEqual({
      ok: true,
      stats: { vertices: 0, triangles: 0, textures: 0, animations: 0 },
    });
  });

  it('returns null stats instead of fabricating counts when accessors are broken', async () => {
    const broken = {
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const result = await extractModelMetadata(gltfFile(broken));
    expect(result).toEqual({
      ok: true,
      stats: { vertices: null, triangles: null, textures: 0, animations: 0 },
    });
  });

  it('rejects a GLB with bad magic bytes', async () => {
    const garbage = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])], 'bad.glb');
    const result = await extractModelMetadata(garbage);
    expect(result).toEqual({
      ok: false,
      error: 'This file could not be read as a glTF model',
    });
  });

  it('rejects a truncated GLB', async () => {
    const full = new Uint8Array(buildGlbBuffer(makeGltfJson()));
    const truncated = new File([full.slice(0, 24)], 'truncated.glb');
    const result = await extractModelMetadata(truncated);
    expect(result.ok).toBe(false);
  });

  it('rejects GLTF text that is not JSON', async () => {
    const file = new File(['{ not json'], 'broken.gltf');
    const result = await extractModelMetadata(file);
    expect(result).toEqual({
      ok: false,
      error: 'This file could not be read as a glTF model',
    });
  });

  it('rejects JSON that is not a glTF document', async () => {
    const file = new File([JSON.stringify({ hello: 'world' })], 'fake.gltf');
    const result = await extractModelMetadata(file);
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported extensions', async () => {
    const file = new File(['anything'], 'model.obj');
    const result = await extractModelMetadata(file);
    expect(result).toEqual({
      ok: false,
      error: 'Only GLB and GLTF files are allowed',
    });
  });
});
