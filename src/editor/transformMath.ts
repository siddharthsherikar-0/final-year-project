import { Euler, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';

/**
 * Pure transform helpers.
 *
 * Everything here is deliberately free of React, R3F and the DOM so the
 * numeric inspector and the snapping rules can be unit tested directly.
 */

export interface TransformValues {
  position: [number, number, number];
  /** Local Euler rotation in degrees, XYZ order. */
  rotation: [number, number, number];
  scale: [number, number, number];
}

const DEG = 180 / Math.PI;

export function toDegrees(radians: number): number {
  return radians * DEG;
}

export function toRadians(degrees: number): number {
  return degrees / DEG;
}

/** Rounds for display without dragging -0 into the UI. */
export function roundDisplay(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function readTransform(object: Object3D): TransformValues {
  // Rotation is read from the quaternion so an object rotated outside the
  // default XYZ order still reports a coherent Euler triple.
  const euler = new Euler().setFromQuaternion(object.quaternion, 'XYZ');
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [toDegrees(euler.x), toDegrees(euler.y), toDegrees(euler.z)],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

/** Rounds every transform component for display. */
export function formatTransform(values: TransformValues, decimals = 3): TransformValues {
  return {
    position: values.position.map((v) => roundDisplay(v, decimals)) as TransformValues['position'],
    rotation: values.rotation.map((v) => roundDisplay(v, decimals)) as TransformValues['rotation'],
    scale: values.scale.map((v) => roundDisplay(v, decimals)) as TransformValues['scale'],
  };
}

export function applyPosition(object: Object3D, value: readonly number[]): void {
  const [x, y, z] = [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
  object.position.set(x, y, z);
  object.updateMatrixWorld(true);
}

export function applyRotationDegrees(object: Object3D, value: readonly number[]): void {
  const [x, y, z] = [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
  const euler = new Euler(toRadians(x), toRadians(y), toRadians(z), 'XYZ');
  object.quaternion.setFromEuler(euler);
  object.updateMatrixWorld(true);
}

/**
 * Applies scale. Zero is rejected: a zero scale matrix is not invertible and
 * would make the object unrecoverable through the gizmo.
 */
export function applyScale(object: Object3D, value: readonly number[]): boolean {
  const [x, y, z] = [value[0], value[1], value[2]];
  if (x === undefined || y === undefined || z === undefined) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
  if (x === 0 || y === 0 || z === 0) return false;
  object.scale.set(x, y, z);
  object.updateMatrixWorld(true);
  return true;
}

/** Snaps to the nearest multiple of `snap`; a non-positive snap is a no-op. */
export function snapValue(value: number, snap: number): number {
  if (!Number.isFinite(snap) || snap <= 0) return value;
  return roundDisplay(Math.round(value / snap) * snap);
}

export function snapTriple(
  value: readonly number[],
  snap: number,
): [number, number, number] {
  return [
    snapValue(value[0] ?? 0, snap),
    snapValue(value[1] ?? 0, snap),
    snapValue(value[2] ?? 0, snap),
  ];
}

export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * World-space bounding centre of an object, used to place the multi-select
 * proxy when one is eventually needed.
 */
export function worldCenter(object: Object3D, target = new Vector3()): Vector3 {
  object.updateWorldMatrix(true, false);
  return target.setFromMatrixPosition(object.matrixWorld);
}

export function worldQuaternion(object: Object3D, target = new Quaternion()): Quaternion {
  object.updateWorldMatrix(true, false);
  return target.setFromRotationMatrix(object.matrixWorld);
}