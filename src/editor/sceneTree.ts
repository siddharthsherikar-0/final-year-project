import type { Mesh, Object3D } from 'three';
import type { ObjectRegistry } from './objectRegistry';

/**
 * Serialisable scene hierarchy.
 *
 * The hierarchy panel renders from plain data, never from live `Object3D`
 * references, so the panel can be tested in jsdom and so React never re-renders
 * because three mutated an object.
 */

export type SceneNodeKind = 'group' | 'mesh' | 'skinnedMesh' | 'bone' | 'object';

export interface SceneNode {
  /** Stable editor id. Identity never depends on the display name. */
  id: string;
  /** Raw name from the asset, or '' when unnamed. */
  name: string;
  /** What the panel shows: the name, or a positional fallback. */
  label: string;
  kind: SceneNodeKind;
  visible: boolean;
  /** Triangles for meshes, null for everything else. */
  triangleCount: number | null;
  /** True when a sibling shares this node's name. */
  duplicateName: boolean;
  children: SceneNode[];
}

/**
 * Selectable kinds.
 *
 * Meshes match viewport picking. Groups are also selectable so a freshly
 * created group can be transformed, but viewport picking still prefers the
 * nearest mesh so clicking a child never silently selects its group.
 */
function selectable(kind: SceneNodeKind): boolean {
  return kind === 'mesh' || kind === 'skinnedMesh' || kind === 'group';
}

function kindOf(object: Object3D): SceneNodeKind {
  // three's Mesh type does not declare the sibling `isSkinnedMesh`/`isGroup`
  // flags, so the object is inspected structurally.
  const candidate = object as Object3D & {
    isMesh?: boolean;
    isSkinnedMesh?: boolean;
    isGroup?: boolean;
    isBone?: boolean;
  };
  if (candidate.isBone === true) return 'bone';
  if (candidate.isSkinnedMesh === true) return 'skinnedMesh';
  if (candidate.isMesh === true) return 'mesh';
  if (candidate.isGroup === true) return 'group';
  return 'object';
}

function trianglesOf(object: Object3D): number | null {
  const mesh = object as Mesh;
  if (mesh.isMesh !== true || !mesh.geometry) return null;
  const indexed = mesh.geometry.index?.count;
  if (typeof indexed === 'number' && indexed > 0) return Math.floor(indexed / 3);
  const positions = mesh.geometry.attributes?.position?.count;
  if (typeof positions === 'number' && positions > 0) return Math.floor(positions / 3);
  return null;
}

/**
 * Builds the hierarchy for a working scene.
 *
 * Unnamed objects get a positional label (`Object 4`) and duplicate names are
 * flagged rather than deduplicated, so two objects called `Cube.001` stay two
 * independently selectable rows.
 */
export function buildSceneTree(root: Object3D, registry: ObjectRegistry): SceneNode[] {
  let fallbackCounter = 0;

  const convert = (object: Object3D): SceneNode | null => {
    const id = registry.idOf(object);
    // Unregistered objects cannot be selected, so they are not surfaced.
    if (!id) return null;

    const kind = kindOf(object);
    const rawName = typeof object.name === 'string' ? object.name.trim() : '';
    fallbackCounter += 1;
    const label = rawName || `${kind === 'mesh' || kind === 'skinnedMesh' ? 'Mesh' : 'Object'} ${fallbackCounter}`;

    const children: SceneNode[] = [];
    for (const child of object.children) {
      const converted = convert(child);
      if (converted) children.push(converted);
    }

    const duplicateName = rawName !== '' && siblingsShareName(object, rawName);

    return {
      id,
      name: rawName,
      label,
      kind,
      visible: object.visible !== false,
      triangleCount: trianglesOf(object),
      duplicateName,
      children,
    };
  };

  const nodes: SceneNode[] = [];
  for (const child of root.children) {
    const converted = convert(child);
    if (converted) nodes.push(converted);
  }
  return nodes;
}

/** True when another sibling carries the same non-empty name. */
function siblingsShareName(object: Object3D, name: string): boolean {
  const parent = object.parent;
  if (!parent) return false;
  let found = 0;
  for (const sibling of parent.children) {
    if (typeof sibling.name === 'string' && sibling.name.trim() === name) {
      found += 1;
      if (found > 1) return true;
    }
  }
  return false;
}

/** Depth-first search for a node by id. */
export function findSceneNode(nodes: SceneNode[], id: string): SceneNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSceneNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Flattened list of every node, in hierarchy order. */
export function flattenSceneNodes(nodes: SceneNode[]): SceneNode[] {
  const flat: SceneNode[] = [];
  const walk = (list: SceneNode[]) => {
    for (const node of list) {
      flat.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}

export { selectable as isSelectableKind };