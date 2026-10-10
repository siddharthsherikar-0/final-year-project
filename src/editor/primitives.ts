import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';

/**
 * Primitive geometry model.
 *
 * A primitive is described by serialisable data only:
 *
 *   mesh.userData.editorPrimitive = { kind, params, version }
 *
 * Nothing three.js-shaped is ever stored. The geometry is regenerated
 * deterministically from these parameters, which is what makes the object
 * restorable, testable in jsdom, and safe to export later.
 */

export const PRIMITIVE_META_KEY = 'editorPrimitive';
export const PRIMITIVE_VERSION = 1;

export type PrimitiveKind =
  | 'box'
  | 'sphere'
  | 'plane'
  | 'cylinder'
  | 'cone'
  | 'torus';

export type PrimitiveParams = Record<string, number>;

export interface PrimitiveDef {
  kind: PrimitiveKind;
  /** Default object name, e.g. `Box`. */
  label: string;
  /** Short description used for tooltips. */
  hint: string;
  params: readonly PrimitiveParamDef[];
  defaults: PrimitiveParams;
}

export interface PrimitiveParamDef {
  key: string;
  label: string;
  /** Dimension-like values are floats; segment counts are integers. */
  type: 'number' | 'segments';
  min: number;
  max: number;
  step: number;
}

/** Guard rails so a mistyped value cannot allocate an unbounded buffer. */
export const MAX_DIMENSION = 1000;
export const MIN_SEGMENTS = 3;
export const MAX_SEGMENTS = 256;

export const PRIMITIVE_DEFS: Readonly<Record<PrimitiveKind, PrimitiveDef>> = {
  box: {
    kind: 'box',
    label: 'Box',
    hint: 'Six-sided solid',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
      { key: 'height', label: 'Height', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
      { key: 'depth', label: 'Depth', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
    ],
    defaults: { width: 1, height: 1, depth: 1 },
  },
  sphere: {
    kind: 'sphere',
    label: 'Sphere',
    hint: 'UV sphere',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.05 },
      { key: 'widthSegments', label: 'Width seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
      { key: 'heightSegments', label: 'Height seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
    ],
    defaults: { radius: 0.5, widthSegments: 32, heightSegments: 24 },
  },
  plane: {
    kind: 'plane',
    label: 'Plane',
    hint: 'Flat surface',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
      { key: 'height', label: 'Height', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
    ],
    defaults: { width: 1, height: 1 },
  },
  cylinder: {
    kind: 'cylinder',
    label: 'Cylinder',
    hint: 'Tube with two radii',
    params: [
      { key: 'radiusTop', label: 'Top radius', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.05 },
      { key: 'radiusBottom', label: 'Bottom radius', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.05 },
      { key: 'height', label: 'Height', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
      { key: 'radialSegments', label: 'Radial seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
    ],
    defaults: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 },
  },
  cone: {
    kind: 'cone',
    label: 'Cone',
    hint: 'Tapered solid',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.05 },
      { key: 'height', label: 'Height', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.1 },
      { key: 'radialSegments', label: 'Radial seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
    ],
    defaults: { radius: 0.5, height: 1, radialSegments: 32 },
  },
  torus: {
    kind: 'torus',
    label: 'Torus',
    hint: 'Ring',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.05 },
      { key: 'tube', label: 'Tube', type: 'number', min: 0.001, max: MAX_DIMENSION, step: 0.01 },
      { key: 'radialSegments', label: 'Radial seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
      { key: 'tubularSegments', label: 'Tubular seg', type: 'segments', min: MIN_SEGMENTS, max: MAX_SEGMENTS, step: 1 },
    ],
    defaults: { radius: 0.5, tube: 0.15, radialSegments: 16, tubularSegments: 48 },
  },
};

export const PRIMITIVE_KINDS = Object.keys(PRIMITIVE_DEFS) as PrimitiveKind[];

export interface PrimitiveMeta {
  kind: PrimitiveKind;
  params: PrimitiveParams;
  version: number;
}

export function defaultParams(kind: PrimitiveKind): PrimitiveParams {
  return { ...PRIMITIVE_DEFS[kind].defaults };
}

export type ValidationResult =
  | { ok: true; params: PrimitiveParams }
  | { ok: false; error: string; key?: string };

/**
 * Validates a partial parameter set for a primitive.
 *
 * Segment counts must be whole numbers within bounds; dimensions must be
 * finite, positive and bounded. Unknown keys are dropped rather than stored.
 */
export function validatePrimitiveParams(
  kind: PrimitiveKind,
  input: Record<string, unknown>,
): ValidationResult {
  const def = PRIMITIVE_DEFS[kind];
  if (!def) return { ok: false, error: `Unknown primitive: ${String(kind)}` };

  const params: PrimitiveParams = {};
  for (const spec of def.params) {
    const raw = input[spec.key];
    if (raw === undefined || raw === null || raw === '') {
      return { ok: false, error: `${spec.label} is required`, key: spec.key };
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      return { ok: false, error: `${spec.label} must be a number`, key: spec.key };
    }
    if (spec.type === 'segments') {
      if (!Number.isInteger(value)) {
        return { ok: false, error: `${spec.label} must be a whole number`, key: spec.key };
      }
      if (value < spec.min || value > spec.max) {
        return { ok: false, error: `${spec.label} must be ${spec.min}–${spec.max}`, key: spec.key };
      }
    } else if (value < spec.min || value > spec.max) {
      return { ok: false, error: `${spec.label} must be ${spec.min}–${spec.max}`, key: spec.key };
    }
    params[spec.key] = value;
  }
  return { ok: true, params };
}

/** Builds real geometry from validated parameters. */
export function buildPrimitiveGeometry(
  kind: PrimitiveKind,
  params: PrimitiveParams,
): BufferGeometry {
  const validated = validatePrimitiveParams(kind, params);
  if (!validated.ok) {
    throw new Error(`Invalid ${kind} parameters: ${validated.error}`);
  }
  const p = validated.params;

  switch (kind) {
    case 'box':
      return new BoxGeometry(p.width, p.height, p.depth);
    case 'sphere':
      return new SphereGeometry(p.radius, p.widthSegments, p.heightSegments);
    case 'plane':
      return new PlaneGeometry(p.width, p.height);
    case 'cylinder':
      return new CylinderGeometry(
        p.radiusTop,
        p.radiusBottom,
        p.height,
        p.radialSegments,
      );
    case 'cone':
      return new ConeGeometry(p.radius, p.height, p.radialSegments);
    case 'torus':
      return new TorusGeometry(p.radius, p.tube, p.radialSegments, p.tubularSegments);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled primitive: ${String(exhaustive)}`);
    }
  }
}

/** True when the kind is one of the six supported primitives. */
export function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return typeof value === 'string' && value in PRIMITIVE_DEFS;
}

/** Reads primitive metadata off a mesh, or null when it is not a primitive. */
export function readPrimitiveMeta(source: unknown): PrimitiveMeta | null {
  const meta = (source as { userData?: Record<string, unknown> } | null | undefined)
    ?.userData?.[PRIMITIVE_META_KEY];
  if (!meta || typeof meta !== 'object') return null;

  const candidate = meta as { kind?: unknown; params?: unknown; version?: unknown };
  if (!isPrimitiveKind(candidate.kind)) return null;
  if (!candidate.params || typeof candidate.params !== 'object') return null;

  const validated = validatePrimitiveParams(candidate.kind, candidate.params as Record<string, unknown>);
  if (!validated.ok) return null;

  return {
    kind: candidate.kind,
    params: validated.params,
    version: typeof candidate.version === 'number' ? candidate.version : PRIMITIVE_VERSION,
  };
}

/** Writes primitive metadata onto an object in serialisable form. */
export function writePrimitiveMeta(
  target: { userData: Record<string, unknown> },
  kind: PrimitiveKind,
  params: PrimitiveParams,
): void {
  target.userData[PRIMITIVE_META_KEY] = {
    kind,
    params: { ...params },
    version: PRIMITIVE_VERSION,
  } satisfies PrimitiveMeta;
}

/** Triangle count of a geometry, used for tests and the hierarchy readout. */
export function triangleCountOf(geometry: BufferGeometry): number {
  const indexed = geometry.index?.count;
  if (typeof indexed === 'number' && indexed > 0) return Math.floor(indexed / 3);
  const positions = geometry.attributes?.position?.count;
  return typeof positions === 'number' ? Math.floor(positions / 3) : 0;
}