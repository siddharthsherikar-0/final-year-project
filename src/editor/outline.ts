import { EdgesGeometry } from 'three';
import type { BufferGeometry } from 'three';

/**
 * Selection outline geometry.
 *
 * Uses `EdgesGeometry` rather than a post-processing outline: it needs no
 * render target, no extra pass over the framebuffer and no custom shader, so
 * it cannot disturb the single-canvas / single-context guarantees. The result
 * is cached per source geometry because it is immutable for a given buffer.
 */

export const OUTLINE_THRESHOLD_DEGREES = 25;

const cache = new WeakMap<BufferGeometry, EdgesGeometry>();

/**
 * Returns a cached edge geometry for a mesh geometry.
 *
 * Returns null when the geometry has no position attribute, which is the only
 * case where an outline would be meaningless.
 */
export function outlineGeometryFor(
  geometry: BufferGeometry | null | undefined,
  thresholdDegrees = OUTLINE_THRESHOLD_DEGREES,
): EdgesGeometry | null {
  if (!geometry) return null;
  const positions = geometry.getAttribute?.('position');
  if (!positions || positions.count === 0) return null;

  const existing = cache.get(geometry);
  if (existing) return existing;

  const edges = new EdgesGeometry(geometry, thresholdDegrees);
  cache.set(geometry, edges);
  return edges;
}

/** True when the outline is worth drawing (a sphere is all edges, a box few). */
export function hasOutlineEdges(geometry: BufferGeometry | null | undefined): boolean {
  const edges = outlineGeometryFor(geometry);
  return edges !== null && edges.getAttribute('position')?.count !== 0;
}