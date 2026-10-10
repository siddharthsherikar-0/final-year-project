import { Mesh, MeshStandardMaterial } from 'three';
import type { Material, Object3D, Texture } from 'three';
import type { WorkingScene } from '../workingScene';
import { TEXTURE_SLOT_KEYS, slotMaterial, setSlotMaterial, captureMaterialSnapshot, type MaterialSnapshot, type TextureSlotKey } from '../materials';
import {
  buildPrimitiveGeometry,
  writePrimitiveMeta,
  type PrimitiveKind,
  type PrimitiveParams,
} from '../primitives';
import { groupObjects, regeneratePrimitive, ungroupObject, canDelete, canDuplicate, duplicateObject } from '../objectOperations';

/**
 * Serialisable editor operations.
 *
 * ================================ WHY DATA, NOT OBJECTS ================================
 * Every operation is plain data - numbers, strings, booleans and ids. A `Mesh`,
 * `Material` or `Texture` is never stored in an operation or in the Zustand
 * store, because neither is serialisable and a stale reference could outlive the
 * scene it belonged to.
 *
 * Objects are addressed by the working scene's stable ids:
 *   - `WorkingScene.registry`      object ids  (`e1a2b3c4-7`)
 *   - `WorkingScene.materialId()`  material ids (`mat-3`)
 *   - `WorkingScene.textureId()`   texture ids  (`tex-2`)
 *
 * The one place an id is not enough is a DELETE. A rigged or morphed GLTF subtree
 * cannot be rebuilt from data (bones, bind matrices, morph targets), so the
 * deleted nodes are parked off-graph and the operation records only the parking
 * id. The panels, the selection and history still address everything by id.
 *
 * ==================================== THE TWO-PHASE SPLIT ====================================
 * `applyOp` performs an operation's FORWARD effect and `invertOp` returns the
 * operation describing its backward effect. Structural changes (create,
 * duplicate, delete, group, ungroup) are modelled as explicit `detach`/`attach`
 * pairs rather than as "re-run the command", so a redo can never depend on the
 * scene still looking the way it did the first time.
 * ==============================================================================================
 */

export interface TransformState {
  p: [number, number, number];
  q: [number, number, number, number];
  s: [number, number, number];
}

export interface TransformEndpoint {
  objectId: string;
  state: TransformState;
}

export type MaterialProperty =
  | 'color'
  | 'roughness'
  | 'metalness'
  | 'opacity'
  | 'transparent'
  | 'emissive'
  | 'emissiveIntensity';

export type MaterialScalar = string | number | boolean;

/**
 * A material value together with the material it was read from.
 *
 * The material id is part of the value because copy-on-write may have CLONED the
 * material during the edit. Undoing such a write must put the ORIGINAL material
 * back into the slot, not merely restore a number on the clone.
 */
export interface MaterialState {
  materialId: string | null;
  value: MaterialScalar;
}

export interface TransformOp {
  kind: 'transform';
  objectId: string;
  before: TransformEndpoint[];
  after: TransformEndpoint[];
}

export interface RenameOp {
  kind: 'rename';
  objectId: string;
  before: string;
  after: string;
}

export interface VisibilityOp {
  kind: 'visibility';
  objectId: string;
  before: boolean;
  after: boolean;
}

export interface GeometryOp {
  kind: 'geometry';
  objectId: string;
  before: PrimitiveParams | null;
  after: PrimitiveParams;
}

export interface CreateObjectOp {
  kind: 'createObject';
  objectId: string;
  primitive: PrimitiveKind;
  params: PrimitiveParams;
  position: [number, number, number];
  name: string;
}

/**
 * Removes `objectIds` from the graph and parks them for a possible undo.
 *
 * Parking happens HERE rather than at record time, because that is the moment
 * the nodes still exist in the graph and their ids, slots and resources can be
 * captured before they go.
 */
export interface DetachOp {
  kind: 'detach';
  objectIds: string[];
}

/** Re-creates a copy of `sourceId` under the id it had before this step. */
export interface DuplicateOp {
  kind: 'duplicate';
  sourceId: string;
  createdId: string;
}

/** Removes these objects; undo re-attaches the parked nodes. */
export interface DeleteOp {
  kind: 'delete';
  objectIds: string[];
}

export interface GroupOp {
  kind: 'group';
  groupId: string;
  groupName: string;
  members: ChildPlacement[];
}

export interface UngroupOp {
  kind: 'ungroup';
  groupId: string;
  groupName: string;
  children: ChildPlacement[];
}

/** Where an object sat in its parent, so a move can be undone exactly. */
export interface ChildPlacement {
  id: string;
  parentId: string | null;
  index: number;
}

export interface MaterialValueOp {
  kind: 'materialValue';
  objectId: string;
  slot: number;
  property: MaterialProperty;
  before: MaterialState;
  after: MaterialState;
}

export interface MaterialAssignOp {
  kind: 'materialAssign';
  objectId: string;
  slot: number;
  before: string | null;
  after: string | null;
}

export interface MaterialRenameOp {
  kind: 'materialRename';
  materialId: string;
  before: string;
  after: string;
}

/**
 * A whole-material restore, used by Reset.
 *
 * Reset touches every property AND every texture slot at once, so it cannot be
 * expressed as one `materialValue`; recording only the first property would make
 * undo leave the rest of the material altered.
 */
export interface MaterialResetOp {
  kind: 'materialReset';
  objectId: string;
  slot: number;
  before: MaterialSnapshotState;
  after: MaterialSnapshotState;
}

/**
 * A material snapshot plus the identity it belongs to.
 *
 * The material id is required because copy-on-write may have swapped the slot
 * to a clone by the time the "after" state is captured.
 */
export interface MaterialSnapshotState {
  materialId: string | null;
  snapshot: MaterialSnapshot;
}

export interface TextureOp {
  kind: 'texture';
  objectId: string;
  slot: number;
  slotKey: TextureSlotKey;
  before: string | null;
  after: string | null;
}

export type EditorOp =
  | TransformOp
  | RenameOp
  | VisibilityOp
  | GeometryOp
  | CreateObjectOp
  | DuplicateOp
  | DeleteOp
  | GroupOp
  | UngroupOp
  | MaterialValueOp
  | MaterialAssignOp
  | MaterialRenameOp
  | MaterialResetOp
  | TextureOp;

/**
 * Re-attaching a parked subtree.
 *
 * Not part of `EditorOp`: an attach can only be expressed once the parking id
 * exists, which is discovered when the matching detach runs. The history entry
 * carries that id, so this stays an internal hand-off rather than a recorded
 * operation.
 */
export interface AttachOp {
  kind: 'attach';
  parkedId: string;
  objectIds: string[];
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  /** Ids that should become selected after this operation applied. */
  selection?: string[];
  /** Present when a destructive op was refused, for the status notice. */
  refused?: { id: string; reason: string }[];
}

const OK: ApplyResult = { ok: true };

/* -------------------------------- parking lot -------------------------------- */

interface ParkedEntry {
  working: WorkingScene;
  /** Every object in the subtree, keyed by the id it had when detached. */
  objects: Map<string, Object3D>;
  /** Top-level objects, in the order they were detached. */
  roots: Object3D[];
  /** Where each top-level object came from, so attach restores the exact slot. */
  placements: Map<string, ChildPlacement>;
  /** Textures the entry needs kept alive for a possible redo. */
  textures: Texture[];
  /** The top-level ids that were actually detached (refusals excluded). */
  detached: string[];
}

const parkingLot = new Map<string, ParkedEntry>();

export interface DetachOutcome {
  parkedId: string;
  detached: string[];
  refused: { id: string; reason: string }[];
}

/**
 * Removes `objectIds` from the graph and parks them, so the step can be undone.
 *
 * Parking happens HERE, at the moment the nodes still exist in the graph, which
 * is the only point at which their ids, sibling slots and resources can be
 * captured before they go. Refusals (rig infrastructure, the root) are reported
 * rather than silently dropped, so the caller can show the same reason the
 * original command did.
 */
export function detachObjects(working: WorkingScene, objectIds: string[]): DetachOutcome {
  const parkedId = `park-${Math.random().toString(36).slice(2, 10)}`;
  const objects = new Map<string, Object3D>();
  const placements = new Map<string, ChildPlacement>();
  const roots: Object3D[] = [];
  const detached: string[] = [];
  const refused: { id: string; reason: string }[] = [];

  objectIds.forEach((id) => {
    const object = working.resolve(id);
    if (!object) {
      refused.push({ id, reason: 'Object not found' });
      return;
    }
    const capability = canDelete(object, working.root);
    if (!capability.allowed) {
      refused.push({ id, reason: capability.reason ?? 'Not deletable' });
      return;
    }

    const parent = object.parent;
    placements.set(id, {
      id,
      parentId: parent ? working.registry.idOf(parent) : null,
      index: parent ? parent.children.indexOf(object) : -1,
    });

    // Capture EVERY descendant id before pruning drops them, so an attach can
    // restore the original identity rather than minting new ids.
    const stack: Object3D[] = [object];
    while (stack.length > 0) {
      const current = stack.pop() as Object3D;
      const currentId = working.registry.idOf(current);
      if (currentId) objects.set(currentId, current);
      for (const child of current.children) stack.push(child);
    }

    working.retainDetached(object);
    object.removeFromParent();
    roots.push(object);
    detached.push(id);
  });

  if (roots.length > 0) {
    parkingLot.set(parkedId, { working, objects, roots, placements, textures: [], detached });
    // Prune AFTER detaching so the removed subtree stops resolving.
    working.registry.prune(working.root);
  }

  return { parkedId, detached, refused };
}

/** Re-attaches a parked subtree under its original ids and sibling slots. */
export function attachParked(working: WorkingScene, parkedId: string): ApplyResult {
  const parked = parkingLot.get(parkedId);
  if (!parked) return { ok: false, error: 'That object is no longer recoverable' };

  const restored: string[] = [];
  for (const id of parked.detached) {
    const object = parked.objects.get(id);
    if (!object) continue;
    const placement = parked.placements.get(id);
    const parent = placement?.parentId ? working.resolve(placement.parentId) : working.root;
    if (!parent) continue;

    // Re-register the whole subtree first so descendants resolve again, then put
    // the root back into the exact slot it vacated.
    restoreIds(working, parked, object);
    placeChild(parent, object, placement?.index ?? parent.children.length);
    restored.push(id);
  }

  if (restored.length === 0) return { ok: false, error: 'That object is no longer recoverable' };
  return { ok: true, selection: restored };
}

/** Re-registers every object in a parked subtree under its original id. */
function restoreIds(working: WorkingScene, parked: ParkedEntry, root: Object3D): void {
  const stack: Object3D[] = [root];
  while (stack.length > 0) {
    const object = stack.pop() as Object3D;
    const id = idFor(parked, object);
    if (id) working.adoptObject(object, id);
    for (const child of object.children) stack.push(child);
  }
}

/** Registers a texture a parked entry needs alive so REDO can still reach it. */
export function retainParkedTexture(parkedId: string, texture: Texture): void {
  const entry = parkingLot.get(parkedId);
  if (!entry || entry.textures.includes(texture)) return;
  entry.textures.push(texture);
  entry.working.retainTexture(texture);
}

/** Releases a parked entry and everything it was holding alive. */
export function unparkSubtree(parkedId: string): void {
  const entry = parkingLot.get(parkedId);
  if (!entry) return;
  parkingLot.delete(parkedId);
  entry.textures.forEach((texture) => entry.working.releaseRetainedTexture(texture));
  entry.roots.forEach((object) => entry.working.releaseDetached(object));
}

/** True when `parkedId` currently holds a subtree (used by tests). */
export function isParked(parkedId: string): boolean {
  return parkingLot.has(parkedId);
}

/* -------------------------------- transforms -------------------------------- */

/** Captures an object's local transform as plain numbers. */
export function captureTransform(object: Object3D | null | undefined): TransformState | null {
  if (!object) return null;
  return {
    p: [object.position.x, object.position.y, object.position.z],
    q: [object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w],
    s: [object.scale.x, object.scale.y, object.scale.z],
  };
}

/** Writes a captured transform onto an object. */
export function applyTransform(
  object: Object3D | null | undefined,
  state: TransformState | null | undefined,
): void {
  if (!object || !state) return;
  object.position.set(state.p[0], state.p[1], state.p[2]);
  object.quaternion.set(state.q[0], state.q[1], state.q[2], state.q[3]);
  object.scale.set(state.s[0], state.s[1], state.s[2]);
  object.updateMatrixWorld(true);
}

/** True when two transforms are indistinguishable at display precision. */
export function sameTransform(a: TransformState | null, b: TransformState | null): boolean {
  if (!a || !b) return a === b;
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  return (
    near(a.p[0], b.p[0]) && near(a.p[1], b.p[1]) && near(a.p[2], b.p[2]) &&
    near(a.q[0], b.q[0]) && near(a.q[1], b.q[1]) && near(a.q[2], b.q[2]) && near(a.q[3], b.q[3]) &&
    near(a.s[0], b.s[0]) && near(a.s[1], b.s[1]) && near(a.s[2], b.s[2])
  );
}

/**
 * Captures the endpoints a transform operation must restore.
 *
 * For an ordinary object this is one endpoint. For a RIGGED object the gizmo
 * moves the skeleton root and keeps the mesh node as a follower, so BOTH are
 * recorded - restoring only one would leave the rig inconsistent.
 */
export function captureEndpoints(
  working: WorkingScene,
  driver: Object3D | null,
  follower: Object3D | null,
): TransformEndpoint[] {
  const endpoints: TransformEndpoint[] = [];
  const push = (object: Object3D | null) => {
    if (!object) return;
    const id = working.registry.idOf(object);
    const state = captureTransform(object);
    if (id && state) endpoints.push({ objectId: id, state });
  };
  push(driver);
  if (follower !== driver) push(follower);
  return endpoints;
}

/* ------------------------------ material value I/O ------------------------------ */

function readMaterialValue(material: Material, property: MaterialProperty): MaterialScalar {
  const bag = material as unknown as Record<string, unknown>;
  if (property === 'color') {
    const color = (material as unknown as { color?: { getHexString: () => string } }).color;
    return color ? `#${color.getHexString()}` : '#ffffff';
  }
  if (property === 'emissive') {
    const emissive = (material as unknown as { emissive?: { getHexString: () => string } }).emissive;
    return emissive ? `#${emissive.getHexString()}` : '#000000';
  }
  return (bag[property] ?? 0) as MaterialScalar;
}

/**
 * Writes a value onto a material instance directly.
 *
 * This deliberately bypasses copy-on-write: history has already decided WHICH
 * material the value belongs to (see `MaterialState.materialId`), so cloning
 * here would break the recorded identity and orphan the original.
 */
export function writeMaterialValue(
  material: Material,
  property: MaterialProperty,
  value: MaterialScalar,
): void {
  const bag = material as unknown as Record<string, unknown>;

  if (property === 'color' || property === 'emissive') {
    const current = (material as unknown as Record<string, { set: (v: string) => void }>)[property];
    if (!current) return;
    current.set(String(value));
    material.needsUpdate = true;
    return;
  }

  bag[property] = value;
  // Blending-mode and slot changes both require a shader recompile.
  material.needsUpdate = true;
}

/** Captures a material property together with the material's stable id. */
export function captureMaterialState(
  working: WorkingScene,
  material: Material | null | undefined,
  property: MaterialProperty,
): MaterialState {
  if (!material) return { materialId: null, value: 0 };
  return { materialId: working.materialId(material), value: readMaterialValue(material, property) };
}

/**
 * Puts a mesh slot onto a specific material and writes a value onto it.
 *
 * This is the primitive behind material undo: it re-establishes BOTH halves of
 * the state - which material the slot holds, and what that material reads.
 */
export function applyMaterialState(
  working: WorkingScene,
  objectId: string,
  slot: number,
  state: MaterialState,
  property: MaterialProperty,
): ApplyResult {
  const object = working.resolve(objectId);
  const mesh = object as Mesh | null;
  if (!mesh || mesh.isMesh !== true) return { ok: false, error: 'Object not found' };

  const material = working.materialOf(state.materialId);
  if (!material) return { ok: false, error: 'Material no longer exists' };

  setSlotMaterial(mesh, slot, material);
  writeMaterialValue(material, property, state.value);
  return OK;
}

/** Captures a whole material plus the id that identifies it. */
export function captureSnapshotState(
  working: WorkingScene,
  material: Material | null | undefined,
): MaterialSnapshotState {
  if (!material) {
    return { materialId: null, snapshot: captureMaterialSnapshot(new MeshStandardMaterial()) };
  }
  return { materialId: working.materialId(material), snapshot: captureMaterialSnapshot(material) };
}

/**
 * Writes a whole snapshot onto a material instance.
 *
 * Textures are restored by reference and are NOT disposed here: the replacement
 * may still be needed by a redo, so release stays the working scene's job.
 */
export function restoreSnapshotState(
  material: Material,
  snapshot: MaterialSnapshot,
): void {
  const bag = material as unknown as Record<string, unknown>;
  const read = snapshot as unknown as Record<string, unknown>;

  for (const key of ['color', 'emissive'] as const) {
    const hex = read[key];
    const color = bag[key] as { set: (v: string) => void } | undefined;
    if (typeof hex === 'string' && color) color.set(hex);
  }
  for (const key of ['roughness', 'metalness', 'emissiveIntensity'] as const) {
    const value = read[key];
    if (typeof value === 'number') bag[key] = value;
  }
  bag.opacity = snapshot.opacity;
  bag.transparent = snapshot.transparent;
  bag.depthWrite = snapshot.depthWrite;

  const textures = snapshot.textures ?? {};
  for (const key of TEXTURE_SLOT_KEYS) {
    if (key in textures) bag[key] = textures[key] ?? null;
  }
  material.needsUpdate = true;
}

/* ----------------------------------- helpers ----------------------------------- */

function meshOf(working: WorkingScene, id: string): Mesh | null {
  const object = working.resolve(id);
  const mesh = object as Mesh | null;
  return mesh && mesh.isMesh === true ? mesh : null;
}

/** Re-inserts `object` into `parent` at its recorded sibling slot. */
function placeChild(parent: Object3D, object: Object3D, index: number): void {
  parent.add(object);
  if (index < 0) return;
  const current = parent.children.indexOf(object);
  if (current < 0) return;
  parent.children.splice(current, 1);
  parent.children.splice(Math.min(index, parent.children.length), 0, object);
}

/* ------------------------------------ apply ------------------------------------ */

/** Executes one operation's forward effect against the live working scene. */
export function applyOp(working: WorkingScene, op: EditorOp): ApplyResult {
  switch (op.kind) {
    case 'transform': {
      for (const endpoint of op.after) {
        applyTransform(working.resolve(endpoint.objectId), endpoint.state);
      }
      return { ok: true, selection: [op.objectId] };
    }

    case 'rename': {
      const object = working.resolve(op.objectId);
      if (!object) return { ok: false, error: 'Object not found' };
      object.name = op.after;
      return { ok: true, selection: [op.objectId] };
    }

    case 'visibility': {
      const object = working.resolve(op.objectId);
      if (!object) return { ok: false, error: 'Object not found' };
      object.visible = op.after;
      return OK;
    }

    case 'geometry': {
      const mesh = meshOf(working, op.objectId);
      if (!mesh) return { ok: false, error: 'Object not found' };
      const result = regeneratePrimitive(working, mesh, op.after);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, selection: [op.objectId] };
    }

    case 'createObject': {
      if (working.resolve(op.objectId)) {
        return { ok: true, selection: [op.objectId] };
      }
      let geometry;
      try {
        geometry = buildPrimitiveGeometry(op.primitive, op.params);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Invalid parameters' };
      }
      working.claimGeometry(geometry);
      const material = working.claimMaterial(
        new MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.6, metalness: 0.05 }),
      );

      const mesh = new Mesh(geometry, material);
      mesh.name = op.name;
      mesh.position.set(op.position[0], op.position[1], op.position[2]);
      writePrimitiveMeta(mesh, op.primitive, op.params);
      working.root.add(mesh);
      working.adoptObject(mesh, op.objectId);
      return { ok: true, selection: [op.objectId] };
    }

    case 'duplicate': {
      if (working.resolve(op.createdId)) {
        return { ok: true, selection: [op.createdId] };
      }
      const source = working.resolve(op.sourceId);
      if (!source) return { ok: false, error: 'Source object not found' };
      const capability = canDuplicate(source);
      if (!capability.allowed) return { ok: false, error: capability.reason };

      const copy = duplicateObject(working, op.sourceId);
      if (!copy.ok || !copy.id || !copy.object) return { ok: false, error: copy.error };
      working.adoptObject(copy.object, op.createdId);
      return { ok: true, selection: [op.createdId] };
    }

    case 'delete': {
      const result = detachObjects(working, op.objectIds);
      if (result.refused.length > 0 && result.refused.length >= op.objectIds.length) {
        return { ok: false, error: result.refused[0]?.reason, refused: result.refused };
      }
      return { ok: true, refused: result.refused };
    }

    case 'group': {
      const result = groupObjects(working, op.members.map((member) => member.id));
      if (!result.ok || !result.group) return { ok: false, error: result.error };
      working.adoptObject(result.group, op.groupId);
      return { ok: true, selection: [op.groupId] };
    }

    case 'ungroup': {
      const result = ungroupObject(working, op.groupId);
      if (!result.ok) return { ok: false, error: result.error };
      // `ungroupObject` re-parents children into the group's parent but not at
      // the exact slots the group replaced, so the recorded placements are
      // replayed here.
      for (const child of op.children) {
        const object = working.resolve(child.id);
        const parent = child.parentId ? working.resolve(child.parentId) : working.root;
        if (object && parent && object.parent === parent) placeChild(parent, object, child.index);
      }
      return { ok: true, selection: op.children.map((child) => child.id) };
    }

    case 'materialValue': {
      const result = applyMaterialState(working, op.objectId, op.slot, op.after, op.property);
      if (!result.ok) return result;
      return { ok: true, selection: [op.objectId] };
    }

    case 'materialAssign': {
      const mesh = meshOf(working, op.objectId);
      if (!mesh) return { ok: false, error: 'Object not found' };
      const material = working.materialOf(op.after);
      if (!material) return { ok: false, error: 'Material no longer exists' };
      setSlotMaterial(mesh, op.slot, material);
      return { ok: true, selection: [op.objectId] };
    }

    case 'materialRename': {
      const material = working.materialOf(op.materialId);
      if (!material) return { ok: false, error: 'Material no longer exists' };
      material.name = op.after;
      return OK;
    }

    case 'materialReset': {
      const mesh = meshOf(working, op.objectId);
      if (!mesh) return { ok: false, error: 'Object not found' };
      const material = working.materialOf(op.after.materialId);
      if (!material) return { ok: false, error: 'Material no longer exists' };
      setSlotMaterial(mesh, op.slot, material);
      restoreSnapshotState(material, op.after.snapshot);
      return { ok: true, selection: [op.objectId] };
    }

    case 'texture': {
      const mesh = meshOf(working, op.objectId);
      if (!mesh) return { ok: false, error: 'Object not found' };
      const material = slotMaterial(mesh, op.slot);
      if (!material) return { ok: false, error: 'That material slot is empty' };
      const texture = working.textureOf(op.after);
      if (op.after !== null && !texture) return { ok: false, error: 'Texture no longer exists' };

      const bag = material as unknown as Record<string, Texture | null>;
      bag[op.slotKey] = texture;
      material.needsUpdate = true;
      return { ok: true, selection: [op.objectId] };
    }

    default:
      return { ok: false, error: 'Unknown operation' };
  }
}

/** Reverse lookup of a parked object's original id. */
function idFor(parked: ParkedEntry, object: Object3D): string | null {
  for (const [id, candidate] of parked.objects) {
    if (candidate === object) return id;
  }
  return null;
}

/* ------------------------------------ invert ------------------------------------ */

/**
 * Returns the operation that reverses `op`, or null when the operation has no
 * inverse of this shape.
 *
 * Only the before/after property operations invert generically. Structural ones
 * (create, duplicate, delete, group, ungroup) are handled explicitly by the
 * history module, because their inverse depends on runtime state - a parked
 * subtree, a recreated node - that does not exist at record time.
 */
export function invertOp(op: EditorOp): EditorOp | null {
  switch (op.kind) {
    case 'transform':
    case 'rename':
    case 'visibility':
    case 'materialAssign':
    case 'materialRename':
    case 'texture':
    case 'materialValue':
      return { ...op, before: op.after, after: op.before } as EditorOp;

    case 'materialReset':
      return { ...op, before: op.after, after: op.before } as EditorOp;

    case 'geometry':
      return op.before ? ({ ...op, before: op.after, after: op.before } as EditorOp) : null;

    default:
      return null;
  }
}