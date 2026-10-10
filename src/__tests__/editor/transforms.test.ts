import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Scene, Vector3 } from 'three';
import {
  applyPosition,
  applyRotationDegrees,
  applyScale,
  formatTransform,
  parseNumericInput,
  readTransform,
  roundDisplay,
  snapTriple,
  snapValue,
  toDegrees,
  toRadians,
} from '@/editor/transformMath';

describe('transform math', () => {
  it('reads a transform and reports rotation in degrees', () => {
    const object = new Object3D();
    object.position.set(1, 2, 3);
    object.rotation.set(Math.PI / 2, 0, 0);

    const values = readTransform(object);

    expect(values.position).toEqual([1, 2, 3]);
    expect(values.rotation[0]).toBeCloseTo(90, 5);
    expect(values.scale).toEqual([1, 1, 1]);
  });

  it('applies position, rotation and scale', () => {
    const object = new Object3D();

    applyPosition(object, [4, 5, 6]);
    applyRotationDegrees(object, [0, 90, 0]);
    expect(applyScale(object, [2, 3, 4])).toBe(true);

    expect(object.position.toArray()).toEqual([4, 5, 6]);
    const values = readTransform(object);
    expect(values.rotation[1]).toBeCloseTo(90, 5);
    expect(values.scale).toEqual([2, 3, 4]);
  });

  it('refuses a zero or non-finite scale so the object stays recoverable', () => {
    const object = new Object3D();
    object.scale.set(2, 2, 2);

    expect(applyScale(object, [0, 1, 1])).toBe(false);
    expect(applyScale(object, [Number.NaN, 1, 1])).toBe(false);
    expect(applyScale(object, [Number.POSITIVE_INFINITY, 1, 1])).toBe(false);

    // The previous scale is preserved rather than corrupted.
    expect(object.scale.toArray()).toEqual([2, 2, 2]);
  });

  it('converts between degrees and radians', () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 6);
    expect(toRadians(180)).toBeCloseTo(Math.PI, 6);
  });

  it('rounds for display and never shows negative zero', () => {
    expect(roundDisplay(1.23456, 2)).toBe(1.23);
    expect(roundDisplay(-0.0001, 2)).toBe(0);
    expect(Object.is(roundDisplay(-0), 0)).toBe(true);
    expect(roundDisplay(Number.NaN)).toBe(0);
  });

  it('formats a whole transform triple', () => {
    const object = new Object3D();
    object.position.set(1.23456, -2.5, 0);

    expect(formatTransform(readTransform(object), 2).position).toEqual([1.23, -2.5, 0]);
  });
});

describe('snapping', () => {
  it('snaps to the nearest increment', () => {
    expect(snapValue(1.1, 0.25)).toBe(1);
    expect(snapValue(1.2, 0.25)).toBe(1.25);
    expect(snapValue(-1.3, 0.5)).toBe(-1.5);
    expect(snapValue(90, 15)).toBe(90);
    expect(snapValue(100, 15)).toBe(105);
  });

  it('is a no-op when snapping is disabled', () => {
    expect(snapValue(1.234, 0)).toBe(1.234);
    expect(snapValue(1.234, -1)).toBe(1.234);
  });

  it('snaps every axis independently', () => {
    expect(snapTriple([0.3, 0.6, 0.9], 0.25)).toEqual([0.25, 0.5, 1]);
  });
});

describe('numeric input parsing', () => {
  it('accepts finite numbers and rejects everything else', () => {
    expect(parseNumericInput('2.5')).toBe(2.5);
    expect(parseNumericInput(' -3 ')).toBe(-3);
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('NaN')).toBeNull();
  });
});

describe('parent-child transform behaviour', () => {
  it('does not move the parent when the child is transformed', () => {
    const parent = new Object3D();
    const child = new Object3D();
    parent.add(child);
    parent.position.set(10, 0, 0);

    applyPosition(child, [0, 5, 0]);

    expect(parent.position.toArray()).toEqual([10, 0, 0]);
    child.updateMatrixWorld(true);
    // World position composes parent * child.
    expect(child.getWorldPosition(new Vector3()).toArray()).toEqual([
      10, 5, 0,
    ]);
  });

  it('composes a rotated parent transform into the child world matrix', () => {
    const parent = new Group();
    const child = new Object3D();
    parent.add(child);
    parent.rotation.y = Math.PI / 2;
    applyPosition(child, [1, 0, 0]);

    parent.updateMatrixWorld(true);
    const world = child.getWorldPosition(new Vector3());
    expect(world.x).toBeCloseTo(0, 5);
    expect(world.z).toBeCloseTo(-1, 5);
  });

  it('leaves sibling objects untouched', () => {
    const parent = new Object3D();
    const a = new Object3D();
    const b = new Object3D();
    parent.add(a, b);

    applyPosition(a, [5, 5, 5]);
    applyScale(a, [3, 3, 3]);

    expect(b.position.toArray()).toEqual([0, 0, 0]);
    expect(b.scale.toArray()).toEqual([1, 1, 1]);
  });
});

describe('transforming real scene objects', () => {
  it('transforms a mesh without touching the cached source mesh', () => {
    const cachedMaterial = new MeshStandardMaterial();
    const cachedGeometry = new BoxGeometry(1, 1, 1);
    const source = new Scene();
    const cachedMesh = new Mesh(cachedGeometry, cachedMaterial);
    source.add(cachedMesh);

    const workingMesh = cachedMesh.clone();
    applyPosition(workingMesh, [7, 7, 7]);

    expect(cachedMesh.position.toArray()).toEqual([0, 0, 0]);
    expect(workingMesh.position.toArray()).toEqual([7, 7, 7]);
    expect(workingMesh.geometry).toBe(cachedGeometry);
    expect(workingMesh.material).toBe(cachedMaterial);
  });
});
