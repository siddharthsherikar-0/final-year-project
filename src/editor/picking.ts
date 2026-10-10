import type { Object3D } from 'three';
import type { ObjectRegistry } from './objectRegistry';

/**
 * Viewport picking.
 *
 * Clicking anywhere on a mesh selects the nearest mesh ancestor, which is the
 * behaviour every mainstream editor uses: clicking a child never silently
 * selects its parent group, and clicking empty space selects nothing.
 */

/** True when the object is a valid selection target in Stage 9B. */
export function isSelectableObject(object: Object3D | null): boolean {
  if (!object) return false;
  const mesh = object as Object3D & { isMesh?: boolean };
  return mesh.isMesh === true;
}

/**
 * Walks up from a raycast hit to the closest selectable mesh.
 *
 * Returns null when the hit is not part of the given working scene, which keeps
 * a click on the grid, the axes helper or the gizmo from clearing or changing
 * the selection.
 */
export function findSelectableAncestor(
  object: Object3D | null | undefined,
  registry: ObjectRegistry,
): Object3D | null {
  let current: Object3D | null = object ?? null;
  while (current) {
    // Stop if we have walked out of the working scene's registered graph.
    if (!registry.idOf(current) && current.parent === null) return null;
    if (isSelectableObject(current) && registry.idOf(current)) return current;
    current = current.parent;
  }
  return null;
}