import { describe, it, expect, vi } from 'vitest';
import { Vector3 } from 'three';
import {
  buildPrimitiveGeometry,
  defaultParams,
  isPrimitiveKind,
  MAX_SEGMENTS,
  PRIMITIVE_DEFS,
  PRIMITIVE_KINDS,
  readPrimitiveMeta,
  triangleCountOf,
  validatePrimitiveParams,
  writePrimitiveMeta,
  type PrimitiveKind,
} from '@/editor/primitives';

/**
 * Primitive model: real geometry, real defaults, real validation.
 * These run in jsdom because three's geometry constructors need no GL.
 */

describe('primitive catalogue', () => {
  it('supports exactly the six documented primitives', () => {
    expect([...PRIMITIVE_KINDS].sort()).toEqual(
      ['box', 'cone', 'cylinder', 'plane', 'sphere', 'torus'].sort(),
    );
  });

  it('exposes the specified default parameters', () => {
    expect(defaultParams('box')).toEqual({ width: 1, height: 1, depth: 1 });
    expect(defaultParams('sphere')).toEqual({ radius: 0.5, widthSegments: 32, heightSegments: 24 });
    expect(defaultParams('plane')).toEqual({ width: 1, height: 1 });
    expect(defaultParams('cylinder')).toEqual({
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      radialSegments: 32,
    });
    expect(defaultParams('cone')).toEqual({ radius: 0.5, height: 1, radialSegments: 32 });
    expect(defaultParams('torus')).toEqual({
      radius: 0.5,
      tube: 0.15,
      radialSegments: 16,
      tubularSegments: 48,
    });
  });

  it('gives every parameter a bound and a step', () => {
    for (const kind of PRIMITIVE_KINDS) {
      for (const spec of PRIMITIVE_DEFS[kind].params) {
        expect(spec.min).toBeGreaterThan(0);
        expect(spec.max).toBeGreaterThan(spec.min);
        expect(spec.step).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildPrimitiveGeometry', () => {
  it('builds real geometry for every primitive', () => {
    for (const kind of PRIMITIVE_KINDS) {
      const geometry = buildPrimitiveGeometry(kind, defaultParams(kind));
      expect(geometry).toBeTruthy();
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(geometry.index?.count ?? 0).toBeGreaterThan(0);
      geometry.dispose();
    }
  });

  it('produces geometry whose size matches the parameters', () => {
    const box = buildPrimitiveGeometry('box', { width: 2, height: 3, depth: 4 });
    box.computeBoundingBox();
    const boxSize = box.boundingBox!.getSize(new Vector3());
    expect(boxSize.x).toBeCloseTo(2, 5);
    expect(boxSize.y).toBeCloseTo(3, 5);
    expect(boxSize.z).toBeCloseTo(4, 5);
    box.dispose();

    const plane = buildPrimitiveGeometry('plane', { width: 5, height: 2 });
    plane.computeBoundingBox();
    const planeSize = plane.boundingBox!.getSize(new Vector3());
    expect(planeSize.x).toBeCloseTo(5, 5);
    expect(planeSize.y).toBeCloseTo(2, 5);
    plane.dispose();

    const cylinder = buildPrimitiveGeometry('cylinder', {
      radiusTop: 1,
      radiusBottom: 3,
      height: 6,
      radialSegments: 32,
    });
    cylinder.computeBoundingBox();
    const cylinderSize = cylinder.boundingBox!.getSize(new Vector3());
    expect(cylinderSize.x).toBeCloseTo(6, 5);
    expect(cylinderSize.y).toBeCloseTo(6, 5);
    cylinder.dispose();
  });

  it('is deterministic for the same parameters', () => {
    const a = buildPrimitiveGeometry('sphere', defaultParams('sphere'));
    const b = buildPrimitiveGeometry('sphere', defaultParams('sphere'));
    expect(a.getAttribute('position').count).toBe(b.getAttribute('position').count);
    expect(triangleCountOf(a)).toBe(triangleCountOf(b));
    a.dispose();
    b.dispose();
  });

  it('reflects segment counts in the vertex count', () => {
    const low = buildPrimitiveGeometry('sphere', { radius: 1, widthSegments: 8, heightSegments: 6 });
    const high = buildPrimitiveGeometry('sphere', { radius: 1, widthSegments: 32, heightSegments: 24 });
    expect(high.getAttribute('position').count).toBeGreaterThan(
      low.getAttribute('position').count,
    );
    low.dispose();
    high.dispose();
  });

  it('refuses invalid parameters instead of building broken geometry', () => {
    expect(() => buildPrimitiveGeometry('box', { width: 0, height: 1, depth: 1 })).toThrow();
    expect(() => buildPrimitiveGeometry('box', { width: 1, height: Number.NaN, depth: 1 })).toThrow();
    expect(() => buildPrimitiveGeometry('sphere', { radius: 1, widthSegments: 2.5, heightSegments: 8 })).toThrow();
  });
});

describe('validatePrimitiveParams', () => {
  it('accepts the defaults of every primitive', () => {
    for (const kind of PRIMITIVE_KINDS) {
      expect(validatePrimitiveParams(kind, defaultParams(kind)).ok).toBe(true);
    }
  });

  it('coerces numeric strings but rejects junk', () => {
    const ok = validatePrimitiveParams('box', { width: '2', height: 1, depth: 1 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.params.width).toBe(2);

    const bad = validatePrimitiveParams('box', { width: 'wide', height: 1, depth: 1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.key).toBe('width');
  });

  it('rejects non-integer and out-of-range segment counts', () => {
    expect(validatePrimitiveParams('cone', { radius: 1, height: 1, radialSegments: 4.5 }).ok).toBe(false);
    expect(validatePrimitiveParams('cone', { radius: 1, height: 1, radialSegments: 2 }).ok).toBe(false);
    expect(validatePrimitiveParams('cone', { radius: 1, height: 1, radialSegments: MAX_SEGMENTS + 1 }).ok).toBe(false);
    expect(validatePrimitiveParams('cone', { radius: 1, height: 1, radialSegments: 64 }).ok).toBe(true);
  });

  it('rejects non-positive and non-finite dimensions', () => {
    expect(validatePrimitiveParams('box', { width: 0, height: 1, depth: 1 }).ok).toBe(false);
    expect(validatePrimitiveParams('box', { width: -1, height: 1, depth: 1 }).ok).toBe(false);
    expect(validatePrimitiveParams('box', { width: Number.POSITIVE_INFINITY, height: 1, depth: 1 }).ok).toBe(false);
    expect(validatePrimitiveParams('torus', { radius: 1, tube: 0, radialSegments: 8, tubularSegments: 8 }).ok).toBe(false);
  });

  it('rejects an unknown primitive kind', () => {
    expect(validatePrimitiveParams('dodecahedron' as PrimitiveKind, {}).ok).toBe(false);
    expect(isPrimitiveKind('dodecahedron')).toBe(false);
    expect(isPrimitiveKind('box')).toBe(true);
  });

  it('drops unknown keys instead of storing them', () => {
    const result = validatePrimitiveParams('box', { width: 1, height: 1, depth: 1, hack: 9 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.params).sort()).toEqual(['depth', 'height', 'width']);
  });
});

describe('primitive metadata', () => {
  it('round-trips serialisable metadata through userData', () => {
    const target = { userData: {} as Record<string, unknown> };
    writePrimitiveMeta(target, 'torus', defaultParams('torus'));

    const meta = readPrimitiveMeta(target);
    expect(meta?.kind).toBe('torus');
    expect(meta?.params.tube).toBe(0.15);
    expect(meta?.version).toBe(1);

    // The stored payload must contain no three.js instances.
    expect(JSON.parse(JSON.stringify(target.userData))).toEqual(target.userData);
  });

  it('returns null for objects that are not primitives', () => {
    expect(readPrimitiveMeta(null)).toBeNull();
    expect(readPrimitiveMeta({ userData: {} })).toBeNull();
    expect(readPrimitiveMeta({ userData: { editorPrimitive: { kind: 'nope', params: {} } } })).toBeNull();
  });

  it('rejects metadata whose parameters are no longer valid', () => {
    expect(
      readPrimitiveMeta({ userData: { editorPrimitive: { kind: 'box', params: { width: -5, height: 1, depth: 1 } } } }),
    ).toBeNull();
  });
});

describe('primitive geometry disposal', () => {
  it('reports triangle counts and disposes cleanly', () => {
    const box = buildPrimitiveGeometry('box', defaultParams('box'));
    expect(triangleCountOf(box)).toBe(12);
    const spy = vi.spyOn(box, 'dispose');
    box.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
