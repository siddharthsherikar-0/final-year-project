import { Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Matrix4, Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WorkingScene } from './workingScene';
import {
  buildPrimitiveGeometry,
  defaultParams,
  readPrimitiveMeta,
  writePrimitiveMeta,
  type PrimitiveKind,
  type PrimitiveParams,
} from './primitives';

/**
 * Object-level editing operations.
 *
 * Every function here mutates the REAL three.js scene graph through the working
 * scene, never the React tree, and never the immutable cached GLTF. Ownership
 * rules are enforced by delegating disposal to `WorkingScene`, which only ever
 * disposes resources it created.
 */

const DUPLICATE_OFFSET = 0.5;
/** userData key recording where a group's children were before grouping. */
const GROUP_INSERT_INDEX_KEY = 'editorGroupInsertIndex';

function isBone(object: Object3D): boolean {
  return (object as Object3D & { isBone?: boolean }).isBone === true;
}

function isSkinnedMesh(object: Object3D): boolean {
  return (object as Object3D & { isSkinnedMesh?: boolean }).isSkinnedMesh === true;
}

function isGroup(object: Object3D): boolean {
  return (object as Object3D & { isGroup?: boolean }).isGroup === true;
}

/** True when the object itself is rig infrastructure or part of a rig. */
export function isRigObject(object: Object3D): boolean {
  if (isBone(object)) return true;
  if (isSkinnedMesh(object)) return true;
  let found = false;
  object.traverse((child) => {
    if (isBone(child) || isSkinnedMesh(child)) found = true;
  });
  return found;
}

export type Capability = { allowed: boolean; reason?: string };

/**
 * Duplicating a rigged object is refused on purpose.
 *
 * A glTF stores bones as SIBLINGS of the skinned mesh, so `SkeletonUtils.clone`
 * on the mesh alone cannot find the bones to rebind and would produce a mesh
 * whose skeleton points at nothing. Duplicating a whole rig needs subtree-level
 * rig duplication, which is out of Stage 9C scope, so the operation is
 * disabled with an explanation rather than shipping a broken duplicate.
 */
export function canDuplicate(object: Object3D | null): Capability {
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  if (isRigObject(object)) {
    return { allowed: false, reason: 'Rigged objects cannot be duplicated safely' };
  }
  return { allowed: true };
}

export function canDelete(object: Object3D | null, root: Object3D): Capability {
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  if (object === root) return { allowed: false, reason: 'The scene root cannot be deleted' };
  if (isBone(object)) return { allowed: false, reason: 'Bones are rig infrastructure' };

  // Deleting a node that CONTAINS bones would tear the rig apart.
  let containsBone = false;
  object.traverse((child) => {
    if (isBone(child)) containsBone = true;
  });
  if (containsBone) return { allowed: false, reason: 'This object holds bones and cannot be deleted' };

  return { allowed: true };
}

export function canGroup(object: Object3D | null): Capability {
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  if (isRigObject(object)) {
    return {
      allowed: false,
      reason: 'Rigged objects cannot be regrouped without breaking skinning',
    };
  }
  return { allowed: true };
}

export function canUngroup(object: Object3D | null): Capability {
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  if (!isGroup(object)) return { allowed: false, reason: 'Not a group' };
  if (isRigObject(object)) {
    return { allowed: false, reason: 'This group contains rig elements' };
  }
  return { allowed: true };
}

/**
 * Returns a name that is unique among the parent's children, using the
 * `Base`, `Base.001`, `Base.002` convention.
 */
export function uniqueName(parent: Object3D, base: string): string {
  const taken = new Set<string>();
  for (const child of parent.children) {
    if (typeof child.name === 'string' && child.name) taken.add(child.name);
  }
  if (!taken.has(base)) return base;
  let index = 1;
  while (taken.has(`${base}.${String(index).padStart(3, '0')}`)) index += 1;
  return `${base}.${String(index).padStart(3, '0')}`;
}

export interface PrimitiveCreationOptions {
  kind: PrimitiveKind;
  params?: PrimitiveParams;
  /** World position for the new object; defaults to the scene origin. */
  position?: Vector3;
}

export interface PrimitiveCreationResult {
  ok: boolean;
  error?: string;
  id?: string;
  mesh?: Mesh;
}

/**
 * Creates a real primitive mesh inside the working scene.
 *
 * Geometry and material are both created by the editor and claimed by the
 * working scene, so they are disposed with it and never touch the cache.
 */
export function createPrimitive(
  working: WorkingScene,
  options: PrimitiveCreationOptions,
): PrimitiveCreationResult {
  const params = options.params ? { ...options.params } : defaultParams(options.kind);
  let geometry;
  try {
    geometry = buildPrimitiveGeometry(options.kind, params);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid parameters' };
  }
  working.claimGeometry(geometry);

  const material = working.claimMaterial(
    new MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.6, metalness: 0.05 }),
  );

  const mesh = new Mesh(geometry, material);
  const parent = working.root;
  mesh.name = uniqueName(parent, defaultName(options.kind));
  mesh.position.copy(options.position ?? new Vector3());
  writePrimitiveMeta(mesh, options.kind, params);

  parent.add(mesh);
  const id = working.registerObject(mesh);
  return { ok: true, id, mesh };
}

function defaultName(kind: PrimitiveKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export interface RegenerateResult {
  ok: boolean;
  error?: string;
  disposedPrevious?: boolean;
}

/**
 * Regenerates a primitive's geometry from new parameters.
 *
 * The mesh keeps its name, id, parent, transform, visibility and material; only
 * the geometry is swapped. The replaced geometry is disposed ONLY when the
 * working scene owns it and nothing else still references it.
 */
export function regeneratePrimitive(
  working: WorkingScene,
  mesh: Mesh,
  params: PrimitiveParams,
): RegenerateResult {
  const meta = readPrimitiveMeta(mesh);
  if (!meta) return { ok: false, error: 'Not an editor primitive' };

  let next;
  try {
    next = buildPrimitiveGeometry(meta.kind, params);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid parameters' };
  }

  const previous = mesh.geometry;
  working.claimGeometry(next);
  mesh.geometry = next;
  // Bounding volumes must be recomputed for the new geometry or the mesh is
  // culled using the old bounds.
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();

  writePrimitiveMeta(mesh, meta.kind, params);

  const disposedPrevious = working.releaseGeometryIfUnused(previous);
  return { ok: true, disposedPrevious };
}

export interface DuplicateResult {
  ok: boolean;
  error?: string;
  id?: string;
  object?: Object3D;
}

/**
 * Duplicates an object.
 *
 * The duplicate receives a fresh stable id and its own geometry clone, so it
 * can be edited or deleted without ever affecting the original or the
 * immutable cached source. Materials stay SHARED with the original, which
 * preserves the scene's material-sharing semantics; the working scene owns
 * them and disposes them once.
 */
export function duplicateObject(working: WorkingScene, id: string): DuplicateResult {
  const source = working.resolve(id);
  if (!source) return { ok: false, error: 'Object not found' };

  const capability = canDuplicate(source);
  if (!capability.allowed) return { ok: false, error: capability.reason };

  const copy = cloneSkeleton(source) as Object3D;
  // copySkeleton already produces independent nodes; for a plain subtree this
  // is a structural deep copy.

  if ((copy as Mesh).isMesh === true) {
    const copyMesh = copy as Mesh;
    // A duplicate must own its geometry so deleting one cannot dispose a
    // geometry the other still uses - and so an imported mesh's shared,
    // immutable source geometry is never handed to a disposable object.
    const clonedGeometry = copyMesh.geometry.clone();
    working.claimGeometry(clonedGeometry);
    copyMesh.geometry = clonedGeometry;
    clonedGeometry.computeBoundingBox();
    clonedGeometry.computeBoundingSphere();

    // Keep parameter metadata meaningful: a duplicated primitive keeps its
    // parameters and regenerates independently.
    const meta = readPrimitiveMeta(source);
    if (meta) writePrimitiveMeta(copyMesh, meta.kind, meta.params);
  }

  const parent = source.parent ?? working.root;
  parent.add(copy);
  copy.name = uniqueName(parent, source.name || 'Object');

  // Predictable offset beside the original, rotated into the source's own
  // world orientation so a duplicated rotated object stays beside its original.
  source.updateWorldMatrix(true, false);
  copy.position.copy(source.position);
  const worldQuaternion = source.getWorldQuaternion(new Quaternion());
  copy.position.add(
    new Vector3(DUPLICATE_OFFSET, 0, DUPLICATE_OFFSET).applyQuaternion(worldQuaternion),
  );
  copy.updateMatrixWorld(true);

  const newId = working.registerObject(copy);
  return { ok: true, id: newId, object: copy };
}

export interface DeleteResult {
  deleted: string[];
  skipped: { id: string; reason: string }[];
}

/**
 * Deletes objects, removing them from the graph, the registry and ownership.
 *
 * Cached source geometry and materials are never disposed: only resources the
 * working scene created, and only when nothing still references them.
 */
export function deleteObjects(working: WorkingScene, ids: readonly string[]): DeleteResult {
  const deleted: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of ids) {
    const object = working.resolve(id);
    if (!object) {
      skipped.push({ id, reason: 'Object not found' });
      continue;
    }
    const capability = canDelete(object, working.root);
    if (!capability.allowed) {
      skipped.push({ id, reason: capability.reason ?? 'Not deletable' });
      continue;
    }

    // Collect geometry BEFORE detaching, while the graph is intact.
    const geometries = new Set<object>();
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry);
    });

    object.removeFromParent();
    working.unregisterObject(id);

    for (const geometry of geometries) {
      working.releaseGeometryIfUnused(geometry as never);
    }
    deleted.push(id);
  }

  // Catch any descendant that went with a deleted ancestor.
  working.registry.prune(working.root);

  return { deleted, skipped };
}

/** Renames an object. Identity (the stable id) is unaffected. */
export function renameObject(
  working: WorkingScene,
  id: string,
  rawName: string,
): { ok: boolean; error?: string; name?: string } {
  const object = working.resolve(id);
  if (!object) return { ok: false, error: 'Object not found' };

  const name = rawName.trim();
  if (!name) return { ok: false, error: 'Name cannot be empty' };
  if (name.length > 96) return { ok: false, error: 'Name is too long' };

  object.name = name;
  return { ok: true, name };
}

/** Sets visibility on the real object. Registry and geometry are untouched. */
export function setObjectVisibility(
  working: WorkingScene,
  id: string,
  visible: boolean,
): { ok: boolean; error?: string } {
  const object = working.resolve(id);
  if (!object) return { ok: false, error: 'Object not found' };
  object.visible = visible;
  return { ok: true };
}

export interface GroupResult {
  ok: boolean;
  error?: string;
  id?: string;
  group?: Group;
}

/**
 * Groups objects under a new `THREE.Group`, preserving every child's
 * world-space transform. This changes the real scene graph, not the UI.
 */
export function groupObjects(working: WorkingScene, ids: readonly string[]): GroupResult {
  if (ids.length < 2) return { ok: false, error: 'Select at least two objects to group' };

  const objects: Object3D[] = [];
  for (const id of ids) {
    const object = working.resolve(id);
    if (!object) return { ok: false, error: 'One of the objects no longer exists' };
    if (object === working.root) return { ok: false, error: 'The scene root cannot be grouped' };
    const capability = canGroup(object);
    if (!capability.allowed) return { ok: false, error: capability.reason };
    objects.push(object);
  }

// Where the children sat BEFORE grouping. Captured before the group is added
  // so ungroup can restore their original sibling slots rather than merely
  // dropping them where the group happened to be.
  const originalIndices = objects.map((object) => working.root.children.indexOf(object));
  const restoreIndex = originalIndices
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), working.root.children.length);

  const group = new Group();
  group.name = uniqueName(working.root, 'Group');
  group.userData[GROUP_INSERT_INDEX_KEY] = restoreIndex;
  working.root.add(group);
  group.updateWorldMatrix(true, false);

  for (const object of objects) {
    object.updateWorldMatrix(true, false);
    const worldMatrix = object.matrixWorld.clone();
    group.attach(object);
    // `attach` already preserves world transforms, but decomposing from the
    // captured matrix makes the intent explicit and robust to three's
    // attach() edge cases with non-uniform parents.
    restoreLocalFromWorld(group, object, worldMatrix);
  }

  const groupId = working.registerObject(group);
  return { ok: true, id: groupId, group };
}

/**
 * Ungroups, re-parenting children back to the group's parent at their original
 * sibling positions while preserving world transforms. The group container is
 * removed; its children and their resources are never disposed.
 */
export function ungroupObject(working: WorkingScene, id: string): GroupResult {
  const group = working.resolve(id);
  if (!group) return { ok: false, error: 'Object not found' };

  const capability = canUngroup(group);
  if (!capability.allowed) return { ok: false, error: capability.reason };

  const parent = group.parent;
  if (!parent) return { ok: false, error: 'Group has no parent' };

const children = [...group.children];
  // Prefer the slot the children held before grouping; fall back to where the
  // group itself currently sits.
  const recorded = group.userData[GROUP_INSERT_INDEX_KEY];
  const groupSlot = parent.children.indexOf(group);
  const insertIndex = typeof recorded === 'number' && recorded >= 0 ? recorded : groupSlot;

  children.forEach((child, offset) => {
    child.updateWorldMatrix(true, false);
    const world = child.matrixWorld.clone();
    parent.add(child);
    if (insertIndex >= 0) {
      const current = parent.children.indexOf(child);
      if (current >= 0) {
        parent.children.splice(current, 1);
        parent.children.splice(insertIndex + offset, 0, child);
      }
    }
    restoreLocalFromWorld(parent, child, world);
  });

  const geometries = new Set<object>();
  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry);
  });

  group.removeFromParent();
  working.unregisterObject(id);
  for (const geometry of geometries) {
    working.releaseGeometryIfUnused(geometry as never);
  }

  return { ok: true, id };
}

/** Restores an object's local transform from a captured world matrix. */
function restoreLocalFromWorld(
  parent: Object3D,
  object: Object3D,
  worldMatrix: Matrix4,
): void {
  parent.updateWorldMatrix(true, false);
  const local = worldMatrix.clone().premultiply(parent.matrixWorld.clone().invert());
  local.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrixWorld(true);
}

