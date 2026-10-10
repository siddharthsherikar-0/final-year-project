import { Vector3 } from 'three';
import type { Object3D } from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  detachEditorTransformControls,
  getEditorControls,
  getEditorWorkingScene,
} from './editorRuntime';
import { buildSceneTree } from './sceneTree';
import {
  canDelete,
  canDuplicate,
  canGroup,
  canUngroup,
  createPrimitive,
  duplicateObject,
  groupObjects,
  regeneratePrimitive,
  renameObject,
  setObjectVisibility,
  ungroupObject,
} from './objectOperations';
import type { Capability } from './objectOperations';
import {
  assignMaterialToSlot,
  assignMaterialTexture,
  clearMaterialTexture,
  createEditorMaterial,
  duplicateMaterial,
  editSharedMaterial,
  renameMaterial,
  resetMaterial,
  sceneMaterialNames,
  sceneMaterials,
  setMaterialColor,
  setMaterialEmissiveColor,
  setMaterialEmissiveIntensity,
  setMaterialOpacity,
  setMaterialScalar,
  setMaterialTransparency,
  type MaterialEditMode,
} from './materialOperations';
import { TEXTURE_SLOT_BY_KEY, slotMaterial, type TextureSlotKey } from './materials';
import { loadTextureFromFile } from './textureLibrary';
import { recordHistory } from './history/history';
import {
  captureMaterialState,
  captureSnapshotState,
  detachObjects,
  type ChildPlacement,
  type MaterialProperty,
} from './history/operations';
import { defaultParams, readPrimitiveMeta } from './primitives';
import type { PrimitiveKind, PrimitiveParams } from './primitives';
import type { Material, Mesh, Texture } from 'three';
import type { WorkingScene } from './workingScene';

/**
 * Editor command layer.
 *
 * Each action performs the real scene mutation through `WorkingScene`, then
 * refreshes the serialisable hierarchy and selection so the panels, the gizmo
 * and the status bar can never drift from the actual three.js scene graph.
 *
 * Nothing here stores an `Object3D`: the live objects are resolved through the
 * registry on demand, and React/Zustand only ever see ids and numbers.
 */

function activeScene(): WorkingScene | null {
  return getEditorWorkingScene();
}

function refreshTree(working: WorkingScene): void {
  useEditorStore.getState().setTree(buildSceneTree(working.root, working.registry));
}

function notify(message: string | null): void {
  useEditorStore.getState().setNotice(message);
}

function markChanged(working: WorkingScene): void {
  refreshTree(working);
  useEditorStore.getState().setModified(true);
  // Any edit makes the session differ from the last saved document.
  useEditorStore.getState().setDirty(true);
  useEditorStore.getState().bumpGeometryEpoch();
}

/**
 * Signals a material change.
 *
 * Separate from `markChanged` on purpose: a material edit does not alter the
 * hierarchy or the geometry, so rebuilding the tree would be wasted work, but it
 * does change the inspection readout (material count, texture count), so that
 * must still be republished.
 */
function markMaterialChanged(): void {
  useEditorStore.getState().setModified(true);
  useEditorStore.getState().setDirty(true);
  useEditorStore.getState().bumpMaterialEpoch();
}

/** Resolves the selected mesh for material commands. */
function selectedMesh(id: string | null | undefined): Mesh | null {
  const working = activeScene();
  if (!working || !id) return null;
  const object = working.resolve(id);
  const mesh = object as Mesh | null;
  return mesh && mesh.isMesh === true ? mesh : null;
}

/** The material occupying `slot`, or null. */
function materialAt(mesh: Mesh, slot: number): Material | null {
  return slotMaterial(mesh, slot);
}

/**
 * Where a new primitive should appear.
 *
 * Uses the orbit target (what the user is currently looking at) so the object
 * is always created inside the view, and never on top of imported geometry.
 */
export function creationPosition(): Vector3 {
  const controls = getEditorControls();
  if (controls?.target) return controls.target.clone();
  return new Vector3();
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export function createPrimitiveAction(kind: PrimitiveKind): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const result = createPrimitive(working, { kind, position: creationPosition() });
  if (!result.ok || !result.id || !result.mesh) {
    notify(result.error ?? 'Could not create primitive');
    return { ok: false, error: result.error };
  }

  const mesh = result.mesh;
  const meta = readPrimitiveMeta(mesh);
  recordHistory(
    {
      kind: 'createObject',
      objectId: result.id,
      primitive: kind,
      params: meta ? meta.params : defaultParams(kind),
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      name: mesh.name,
    },
    `Create ${kind}`,
  );

  markChanged(working);
  useEditorStore.getState().setSelection([result.id]);
  notify(`Created ${mesh.name}`);
  return { ok: true, id: result.id };
}

export function regeneratePrimitiveAction(
  id: string,
  params: PrimitiveParams,
): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const mesh = working.resolve(id) as never;
  if (!mesh) return { ok: false, error: 'Object not found' };

  const previous = readPrimitiveMeta(mesh as Mesh)?.params ?? null;

  const result = regeneratePrimitive(working, mesh, params);
  if (!result.ok) {
    notify(result.error ?? 'Invalid parameters');
    return { ok: false, error: result.error };
  }

  if (previous) {
    recordHistory(
      { kind: 'geometry', objectId: id, before: previous, after: params },
      'Edit geometry',
    );
  }

  markChanged(working);
  notify('Geometry updated');
  return { ok: true, id };
}

export function duplicateAction(id: string): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const result = duplicateObject(working, id);
  if (!result.ok || !result.id || !result.object) {
    notify(result.error ?? 'Could not duplicate');
    return { ok: false, error: result.error };
  }

  // Recorded as a `duplicate` operation: undo removes exactly the copy and redo
  // rebuilds it under its original id, so repeating undo/redo cannot drift the
  // duplicate further from the original on each pass.
  recordHistory(
    { kind: 'duplicate', sourceId: id, createdId: result.id },
    `Duplicate ${result.object.name}`,
  );

  markChanged(working);
  useEditorStore.getState().setSelection([result.id]);
  notify(`Duplicated as ${result.object.name}`);
  return { ok: true, id: result.id };
}

export function deleteAction(ids: readonly string[]): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  // Detach the gizmo BEFORE the object leaves the scene graph, otherwise three
  // renders one frame with the controls pointing at a detached object.
  detachEditorTransformControls();

  // The real removal is performed by `detachObjects`, which also parks the nodes
  // so the delete can be undone. Routing through history's apply keeps one
  // implementation of "remove and remember".
  const outcome = detachObjects(working, [...ids]);
  if (outcome.detached.length === 0) {
    notify(outcome.refused[0]?.reason ?? 'Nothing was deleted');
    return { ok: false, error: outcome.refused[0]?.reason };
  }
  if (outcome.refused.length > 0) {
    notify(outcome.refused[0]?.reason ?? 'Some objects were skipped');
  } else {
    notify(
      `Deleted ${outcome.detached.length} object${outcome.detached.length === 1 ? '' : 's'}`,
    );
  }

  recordHistory({ kind: 'delete', objectIds: outcome.detached }, 'Delete', null, outcome.parkedId);

  markChanged(working);
  // Drop any selection that pointed at a deleted object.
  useEditorStore.getState().retainSelection(working.registry.ids());
  return { ok: true };
}

export function renameAction(id: string, rawName: string): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const object = working.resolve(id);
  const previousName = object?.name ?? '';

  const result = renameObject(working, id, rawName);
  if (!result.ok) {
    notify(result.error ?? 'Could not rename');
    return { ok: false, error: result.error };
  }

  if (result.name !== previousName) {
    recordHistory(
      { kind: 'rename', objectId: id, before: previousName, after: result.name ?? rawName },
      `Rename to ${result.name}`,
      `rename:${id}`,
    );
  }

  refreshTree(working);
  useEditorStore.getState().setModified(true);
  useEditorStore.getState().setDirty(true);
  notify('Renamed');
  return { ok: true, id };
}

export function setVisibilityAction(id: string, visible: boolean): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const previous = working.resolve(id)?.visible ?? visible;

  const result = setObjectVisibility(working, id, visible);
  if (!result.ok) {
    notify(result.error ?? 'Could not change visibility');
    return { ok: false, error: result.error };
  }

  if (previous !== visible) {
    recordHistory(
      { kind: 'visibility', objectId: id, before: previous, after: visible },
      visible ? 'Show object' : 'Hide object',
    );
  }

  refreshTree(working);
  useEditorStore.getState().setModified(true);
  useEditorStore.getState().setDirty(true);
  return { ok: true, id };
}

export function groupAction(ids: readonly string[]): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  // Recorded before the regroup so undo can put every member back in the exact
  // parent and sibling slot it occupied.
  const placements: ChildPlacement[] = ids.map((id) => {
    const object = working.resolve(id);
    const parent = object?.parent ?? null;
    return {
      id,
      parentId: parent ? working.registry.idOf(parent) : null,
      index: parent ? parent.children.indexOf(object as never) : -1,
    };
  });

  const result = groupObjects(working, ids);
  if (!result.ok || !result.id || !result.group) {
    notify(result.error ?? 'Could not group');
    return { ok: false, error: result.error };
  }

  recordHistory(
    {
      kind: 'group',
      groupId: result.id,
      groupName: result.group.name,
      members: placements,
    },
    `Group ${result.group.name}`,
  );

  markChanged(working);
  useEditorStore.getState().setSelection([result.id]);
  notify('Grouped');
  return { ok: true, id: result.id };
}

export function ungroupAction(id: string): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const group = working.resolve(id);
  const children: ChildPlacement[] = (group?.children ?? []).map((child) => ({
    id: working.registry.idOf(child) ?? '',
    parentId: id,
    index: (group?.children.indexOf(child) ?? 0) + 1000000,
  }));

  detachEditorTransformControls();

  const result = ungroupObject(working, id);
  if (!result.ok) {
    notify(result.error ?? 'Could not ungroup');
    return { ok: false, error: result.error };
  }

  recordHistory(
    {
      kind: 'ungroup',
      groupId: id,
      groupName: group?.name ?? 'Group',
      children,
    },
    'Ungroup',
  );

  markChanged(working);
  useEditorStore.getState().clearSelection();
  notify('Ungrouped');
  return { ok: true };
}

/* ------------------------------ material actions --------------------------- */

/**
 * Shared plumbing for every material write.
 *
 * The store's `sharedMaterialEditing` flag is honoured here rather than in each
 * operation: with it off (the default) the operation copy-on-writes through
 * `takeOwnershipOfMaterial`; with it on, the shared material instance is
 * resolved first and edited in place. Doing this in one place is what keeps the
 * default behaviour consistently "edit selected only".
 *
 * The material state is captured BOTH sides of the write. That is what makes a
 * copy-on-write edit undoable: if the write cloned the material, the "before"
 * state names the ORIGINAL instance, so undo puts that one back in the slot
 * instead of leaving a detached clone holding the old colour.
 */
function writeMaterial(
  id: string,
  slot: number,
  property: MaterialProperty,
  apply: (
    working: WorkingScene,
    mesh: Mesh,
    targetSlot: number,
    mode: MaterialEditMode,
  ) => { ok: boolean; error?: string },
  successMessage: string,
): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const before = captureMaterialState(working, slotMaterial(mesh, slot), property);

  const mode: MaterialEditMode = useEditorStore.getState().sharedMaterialEditing
    ? 'shared'
    : 'selected';

  if (mode === 'shared') {
    const shared = editSharedMaterial(working, mesh, slot);
    if (!shared.ok || !shared.material) {
      notify(shared.error ?? 'Could not edit the shared material');
      return { ok: false, error: shared.error };
    }
  }

  const result = apply(working, mesh, slot, mode);
  if (!result.ok) {
    notify(result.error ?? 'Material update failed');
    return { ok: false, error: result.error };
  }

  const after = captureMaterialState(working, slotMaterial(mesh, slot), property);
  recordHistory(
    { kind: 'materialValue', objectId: id, slot, property, before, after },
    successMessage,
    // Drags and repeated nudges of the same slider merge into one step.
    `material:${id}:${slot}:${property}`,
  );

  markMaterialChanged();
  notify(successMessage);
  return { ok: true, id };
}

export function setMaterialColorAction(id: string, slot: number, hex: string): ActionResult {
  return writeMaterial(
    id,
    slot,
    'color',
    (working, mesh, targetSlot, mode) => setMaterialColor(working, mesh, targetSlot, hex, mode),
    'Base colour updated',
  );
}

export function setMaterialRoughnessAction(id: string, slot: number, value: number): ActionResult {
  return writeMaterial(
    id,
    slot,
    'roughness',
    (working, mesh, targetSlot, mode) => setMaterialScalar(working, mesh, targetSlot, 'roughness', value, mode),
    'Roughness updated',
  );
}

export function setMaterialMetalnessAction(id: string, slot: number, value: number): ActionResult {
  return writeMaterial(
    id,
    slot,
    'metalness',
    (working, mesh, targetSlot, mode) => setMaterialScalar(working, mesh, targetSlot, 'metalness', value, mode),
    'Metalness updated',
  );
}

export function setMaterialOpacityAction(id: string, slot: number, value: number): ActionResult {
  return writeMaterial(
    id,
    slot,
    'opacity',
    (working, mesh, targetSlot, mode) => setMaterialOpacity(working, mesh, targetSlot, value, mode),
    'Opacity updated',
  );
}

export function setMaterialTransparencyAction(
  id: string,
  slot: number,
  transparent: boolean,
): ActionResult {
  return writeMaterial(
    id,
    slot,
    'transparent',
    (working, mesh, targetSlot, mode) => setMaterialTransparency(working, mesh, targetSlot, transparent, mode),
    transparent ? 'Transparency on' : 'Transparency off',
  );
}

export function setMaterialEmissiveColorAction(id: string, slot: number, hex: string): ActionResult {
  return writeMaterial(
    id,
    slot,
    'emissive',
    (working, mesh, targetSlot, mode) => setMaterialEmissiveColor(working, mesh, targetSlot, hex, mode),
    'Emissive colour updated',
  );
}

export function setMaterialEmissiveIntensityAction(
  id: string,
  slot: number,
  value: number,
): ActionResult {
  return writeMaterial(
    id,
    slot,
    'emissiveIntensity',
    (working, mesh, targetSlot, mode) => setMaterialEmissiveIntensity(working, mesh, targetSlot, value, mode),
    'Emissive intensity updated',
  );
}

export function duplicateMaterialAction(id: string, slot: number): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const result = duplicateMaterial(working, mesh, slot);
  if (!result.ok) {
    notify(result.error ?? 'Could not duplicate material');
    return { ok: false, error: result.error };
  }
  markMaterialChanged();
  notify(`Duplicated as ${result.material?.name ?? 'material'}`);
  return { ok: true, id };
}

export function resetMaterialAction(id: string, slot: number): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const before = captureSnapshotState(working, materialAt(mesh, slot));

  const result = resetMaterial(working, mesh, slot);
  if (!result.ok) {
    notify(result.error ?? 'Could not reset material');
    return { ok: false, error: result.error };
  }

  const after = captureSnapshotState(working, materialAt(mesh, slot));
  recordHistory(
    { kind: 'materialReset', objectId: id, slot, before, after },
    'Reset material',
  );

  markMaterialChanged();
  notify('Material reset to its starting values');
  return { ok: true, id };
}

export function renameMaterialAction(id: string, slot: number, name: string): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const material = Array.isArray(mesh.material)
    ? mesh.material[slot]
    : slot === 0
      ? mesh.material
      : null;
  if (!material) return { ok: false, error: 'That material slot is empty' };

  const beforeName = material.name;
  const result = renameMaterial(working, material, name);
  if (!result.ok) {
    notify(result.error ?? 'Could not rename material');
    return { ok: false, error: result.error };
  }
  const afterName = material.name;
  if (afterName !== beforeName) {
    recordHistory(
      {
        kind: 'materialRename',
        materialId: working.materialId(material) ?? '',
        before: beforeName,
        after: afterName,
      },
      'Rename material',
    );
  }
  markMaterialChanged();
  notify('Material renamed');
  return { ok: true, id };
}

/**
 * Creates a new editor-owned PBR material and assigns it to the active slot.
 *
 * Assigning replaces exactly one slot, so a multi-material mesh keeps its other
 * materials and its geometry groups stay correct.
 */
export function createMaterialAction(id: string, slot: number): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const beforeId = working.materialId(materialAt(mesh, slot));

  const material = createEditorMaterial(working);
  const result = assignMaterialToSlot(working, mesh, slot, material);
  if (!result.ok) {
    notify(result.error ?? 'Could not assign the new material');
    return { ok: false, error: result.error };
  }
  recordHistory(
    {
      kind: 'materialAssign',
      objectId: id,
      slot,
      before: beforeId,
      after: working.materialId(material),
    },
    'New material',
  );
  markMaterialChanged();
  notify(`Created ${material.name}`);
  return { ok: true, id };
}

/**
 * Assigns an existing material, chosen by name from the current scene.
 *
 * Resolution is by identity: the caller passes a live material resolved through
 * the working scene, never a name that could match the wrong object.
 */
export function assignMaterialAction(id: string, slot: number, material: Mesh['material']): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const beforeId = working.materialId(materialAt(mesh, slot));

  const next = Array.isArray(material) ? material[0] : material;
  if (!next) return { ok: false, error: 'No material selected' };

  const result = assignMaterialToSlot(working, mesh, slot, next);
  if (!result.ok) {
    notify(result.error ?? 'Could not assign that material');
    return { ok: false, error: result.error };
  }
  recordHistory(
    {
      kind: 'materialAssign',
      objectId: id,
      slot,
      before: beforeId,
      after: working.materialId(next),
    },
    'Assign material',
  );
  markMaterialChanged();
  notify(`Assigned ${next.name || 'material'}`);
  return { ok: true, id };
}

export interface TextureImportResult extends ActionResult {
  width?: number | null;
  height?: number | null;
}

/**
 * Loads a texture from a browser File and assigns it to one material slot.
 *
 * The material is NOT touched until the file has decoded successfully, so an
 * unsupported type, an oversized file, or a corrupt image all leave the
 * existing material exactly as it was - which is why a failure here reports an
 * error instead of clearing the slot.
 */
export async function importTextureAction(
  id: string,
  slot: number,
  textureKey: TextureSlotKey,
  file: File,
): Promise<TextureImportResult> {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const slotDef = TEXTURE_SLOT_BY_KEY[textureKey];
  if (!slotDef) return { ok: false, error: `Unknown texture slot: ${textureKey}` };

  // AWAITED before touching the material. The loader rejects an unsupported
  // type, an oversized file, an undecodable image, or one beyond the GPU's
  // maximum texture size, so every one of those leaves the existing material -
  // and its working texture - exactly as it was.
  const loaded = await loadTextureFromFile(file, slotDef);
  if (!loaded.ok) {
    notify(loaded.error);
    return { ok: false, error: loaded.error };
  }

  // The selection may have moved while the image decoded; a stale write would
  // apply a texture to whatever is selected now.
  if (!mesh.isMesh || mesh.parent === null) {
    loaded.texture.dispose();
    return { ok: false, error: 'The selection changed while the image was loading' };
  }

  const targetMaterial = materialAt(mesh, slot);
  const beforeTextureId = working.textureId(
    targetMaterial ? ((targetMaterial as unknown as Record<string, Texture | null>)[textureKey] ?? null) : null,
  );

  const result = assignMaterialTexture(working, mesh, slot, textureKey, loaded.texture, {
    mode: useEditorStore.getState().sharedMaterialEditing ? 'shared' : 'selected',
  });
  if (!result.ok) {
    // The texture decoded but could not be assigned: it is unreferenced, so it
    // must be released here or it leaks.
    loaded.texture.dispose();
    notify(result.error ?? 'Could not assign that texture');
    return { ok: false, error: result.error };
  }

  // The assignment may have copy-on-written onto a clone, so the "after" texture
  // is read back from the slot rather than assumed to be the one just loaded.
  const appliedMaterial = materialAt(mesh, slot);
  const afterTextureId = working.textureId(
    appliedMaterial ? ((appliedMaterial as unknown as Record<string, Texture | null>)[textureKey] ?? null) : null,
  );

  recordHistory(
    { kind: 'texture', objectId: id, slot, slotKey: textureKey, before: beforeTextureId, after: afterTextureId },
    `${slotDef.label} texture`,
  );

  markMaterialChanged();
  notify(`${slotDef.label} texture replaced (${loaded.width}x${loaded.height})`);
  return { ok: true, id, width: loaded.width, height: loaded.height };
}

export function clearTextureAction(id: string, slot: number, textureKey: TextureSlotKey): ActionResult {
  const working = activeScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };
  const mesh = selectedMesh(id);
  if (!mesh) return { ok: false, error: 'Select a mesh to edit its material' };

  const targetMaterial = materialAt(mesh, slot);
  const beforeTextureId = working.textureId(
    targetMaterial ? ((targetMaterial as unknown as Record<string, Texture | null>)[textureKey] ?? null) : null,
  );

  const result = clearMaterialTexture(
    working,
    mesh,
    slot,
    textureKey,
    useEditorStore.getState().sharedMaterialEditing ? 'shared' : 'selected',
  );
  if (!result.ok) {
    notify(result.error ?? 'Could not clear that texture');
    return { ok: false, error: result.error };
  }

  recordHistory(
    { kind: 'texture', objectId: id, slot, slotKey: textureKey, before: beforeTextureId, after: null },
    `Clear ${TEXTURE_SLOT_BY_KEY[textureKey]?.label ?? 'texture'}`,
  );

  markMaterialChanged();
  notify(`${TEXTURE_SLOT_BY_KEY[textureKey]?.label ?? 'Texture'} cleared`);
  return { ok: true, id };
}

/** Names of every material in the scene, for the assignment picker. */
export function materialLibraryAction(): string[] {
  const working = activeScene();
  return working ? sceneMaterialNames(working) : [];
}

/**
 * Resolves a live material from the scene by its position in the distinct
 * material list.
 *
 * The picker stores an INDEX, so this walks the scene and returns the Nth
 * distinct material instance. Returns null when the index no longer resolves
 * (the scene changed under the open picker) - a safe miss rather than the wrong
 * material.
 */
export function resolveLibraryMaterial(index: number): Mesh['material'] | null {
  const working = activeScene();
  if (!working || !Number.isInteger(index) || index < 0) return null;
  return sceneMaterials(working)[index] ?? null;
}

/* ----------------------------- capability probes ---------------------------- */
/* Used to render honest disabled states instead of buttons that silently do
   nothing, and to surface the reason. */

function probe(
  selected: Object3D | null,
  check: (object: Object3D | null) => Capability,
): Capability {
  const working = activeScene();
  if (!working) return { allowed: false, reason: 'Scene is not ready' };
  return check(selected);
}

export function duplicateCapability(id: string | null): Capability {
  const working = activeScene();
  if (!working) return { allowed: false, reason: 'Scene is not ready' };
  return probe(working.resolve(id), canDuplicate);
}

export function deleteCapability(id: string | null): Capability {
  const working = activeScene();
  if (!working) return { allowed: false, reason: 'Scene is not ready' };
  const object = working.resolve(id);
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  return canDelete(object, working.root);
}

export function groupCapability(ids: readonly string[]): Capability {
  const working = activeScene();
  if (!working) return { allowed: false, reason: 'Scene is not ready' };
  if (ids.length < 2) return { allowed: false, reason: 'Select at least two objects' };
  for (const id of ids) {
    const object = working.resolve(id);
    if (!object) return { allowed: false, reason: 'One of the objects no longer exists' };
    const capability = canGroup(object);
    if (!capability.allowed) return capability;
  }
  return { allowed: true };
}

export function ungroupCapability(id: string | null): Capability {
  const working = activeScene();
  if (!working) return { allowed: false, reason: 'Scene is not ready' };
  const object = working.resolve(id);
  if (!object) return { allowed: false, reason: 'Nothing selected' };
  return canUngroup(object);
}
