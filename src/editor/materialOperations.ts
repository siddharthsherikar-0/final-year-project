import { Color, MeshStandardMaterial } from 'three';
import type { Material, Mesh, Texture } from 'three';
import type { WorkingScene } from './workingScene';
import {
  MAX_EMISSIVE_INTENSITY,
  TEXTURE_SLOT_BY_KEY,
  clampNonNegative,
  clampUnit,
  isMultiMaterial,
  materialCapabilities,
  normalizeHex,
  setSlotMaterial,
  slotCount,
  slotMaterial,
  validateMaterialName,
  type MaterialSnapshot,
  type TextureSlotKey,
} from './materials';
import { configureTexture } from './textureLibrary';

/**
 * Material operations.
 *
 * Every function mutates the REAL three.js material on the live working scene.
 * The default posture is COPY-ON-WRITE: editing one object clones a shared
 * material for that object's slot instead of restyling everything that happens
 * to reference it. Sharing is only broken deliberately, via `editShared` or by
 * assigning a material to several slots at once.
 *
 * ===================================================== TRANSPARENCY =========
 * `opacity` alone is NOT visible in three.js. A material only blends when
 * `transparent` is true, and even then `depthWrite` still on makes a
 * semi-transparent surface occlude objects drawn after it, which reads as
 * flickering z-fighting. So the three fields move together:
 *
 *   transparent off  -> opacity forced to 1, depthWrite restored
 *   transparent on   -> depthWrite disabled unless opacity is fully opaque
 *
 * That is applied as one atomic decision in `setMaterialOpacity` /
 * `setMaterialTransparency` rather than leaving each control to half-configure
 * the material.
 * ===========================================================================
 */

export type MaterialResult = { ok: boolean; error?: string };

export interface SlotResult extends MaterialResult {
  /** The material actually written to - a clone when copy-on-write kicked in. */
  material?: Material;
  /** True when the write required cloning a shared material. */
  copied?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              Property writers                              */
/* -------------------------------------------------------------------------- */

/**
 * How a property write resolves the material to mutate.
 *
 * `selected` (the default) copy-on-writes: a shared material is cloned for this
 * slot so nothing else changes. `shared` edits the existing instance in place,
 * which is the deliberate opt-in for "apply to every user of this material".
 */
export type MaterialEditMode = 'selected' | 'shared';

/**
 * The material a write should land on.
 *
 * Returns the current instance unchanged for `shared`, or the (possibly newly
 * cloned) copy-on-write material for `selected`. Centralising this is what makes
 * the two postures consistent across colour, scalars, transparency, emissive
 * and texture writes - a per-function decision would eventually diverge.
 */
export function resolveWriteTarget(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  mode: MaterialEditMode,
): Material | null {
  return mode === 'shared'
    ? slotMaterial(mesh, slot)
    : working.takeOwnershipOfMaterial(mesh, slot);
}

type ColorRecord = Record<string, unknown>;

function setColorHex(material: Material, key: string, hex: string): boolean {
  const target = (material as unknown as ColorRecord)[key] as Color | undefined;
  if (!target || target.isColor !== true) return false;
  // `setStyle` performs sRGB -> working colour space conversion, which is what
  // a hex the user typed in the colour picker means.
  target.setStyle(hex);
  return true;
}

function requireWritable(material: Material, capability: keyof ReturnType<typeof materialCapabilities>): string | null {
  const capabilities = materialCapabilities(material);
  if (!capabilities.editable) return capabilities.reason ?? 'This material cannot be edited';
  if (!capabilities[capability]) {
    return `${capabilities.type} does not support this property`;
  }
  return null;
}

/** Writes the base colour. */
export function setMaterialColor(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  rawHex: string,
  mode: MaterialEditMode = 'selected',
): SlotResult {
  const hex = normalizeHex(rawHex);
  if (!hex.ok) return { ok: false, error: hex.error };

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, 'color');
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };
  if (!setColorHex(target, 'color', hex.hex)) {
    return { ok: false, error: 'This material has no base colour' };
  }
  return { ok: true, material: target, copied: target !== current };
}

export interface ScalarSlotResult extends SlotResult {
  value?: number;
}

/** Writes a 0..1 PBR factor (roughness, metalness). */
export function setMaterialScalar(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  property: 'roughness' | 'metalness',
  rawValue: number,
  mode: MaterialEditMode = 'selected',
): ScalarSlotResult {
  const value = clampUnit(rawValue);
  if (value === null) return { ok: false, error: `${property} must be a number between 0 and 1` };

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, property);
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };
  (target as unknown as ColorRecord)[property] = value;
  return { ok: true, material: target, value, copied: target !== current };
}

/**
 * Writes opacity and keeps transparency coherent.
 *
 * Asking for an opacity below 1 turns `transparent` ON automatically, because
 * otherwise the control would appear to do nothing - three.js ignores opacity
 * on an opaque material. Dropping back to 1 turns it OFF again and restores
 * depth writing, so the material does not linger in the transparent queue where
 * it would sort incorrectly against other geometry.
 */
export function setMaterialOpacity(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  rawValue: number,
  mode: MaterialEditMode = 'selected',
): ScalarSlotResult {
  const value = clampUnit(rawValue);
  if (value === null) return { ok: false, error: 'Opacity must be a number between 0 and 1' };

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, 'opacity');
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };

  target.opacity = value;
  const fullyOpaque = value >= 1;
  if (fullyOpaque) {
    target.transparent = false;
    target.depthWrite = true;
  } else {
    target.transparent = true;
    // Depth writing while blending causes the classic semi-transparent
    // z-fighting against whatever was drawn first.
    target.depthWrite = false;
  }
  // `transparent` changes the render state and blending path, so the program
  // must be recompiled.
  target.needsUpdate = true;

  return { ok: true, material: target, value, copied: target !== current };
}

/**
 * Toggles transparency without touching opacity.
 *
 * Turning it ON with an opacity of 1 makes the material blend pointlessly and
 * pushes it into the sorted queue, so opacity drops to 0.99 - a value that is
 * visually identical to opaque but actually exercises the transparent path.
 */
export function setMaterialTransparency(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  transparent: boolean,
  mode: MaterialEditMode = 'selected',
): SlotResult {
  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, 'opacity');
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };

  target.transparent = transparent;
  if (transparent) {
    if (target.opacity >= 1) target.opacity = 0.99;
    target.depthWrite = false;
  } else {
    target.opacity = 1;
    target.depthWrite = true;
  }
  target.needsUpdate = true;
  return { ok: true, material: target, copied: target !== current };
}

/** Writes emissive colour. */
export function setMaterialEmissiveColor(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  rawHex: string,
  mode: MaterialEditMode = 'selected',
): SlotResult {
  const hex = normalizeHex(rawHex);
  if (!hex.ok) return { ok: false, error: hex.error };

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, 'emissive');
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };
  if (!setColorHex(target, 'emissive', hex.hex)) {
    return { ok: false, error: 'This material has no emissive colour' };
  }
  return { ok: true, material: target, copied: target !== current };
}

/**
 * Writes emissive intensity.
 *
 * Zero disables emission entirely. Because three adds emissive on top of the
 * lit result, an intensity above 1 is meaningful (HDR), but it is bounded so a
 * pasted number cannot blow the surface out to flat white.
 */
export function setMaterialEmissiveIntensity(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  rawValue: number,
  mode: MaterialEditMode = 'selected',
): ScalarSlotResult {
  const value = clampNonNegative(rawValue, MAX_EMISSIVE_INTENSITY);
  if (value === null) {
    return { ok: false, error: `Emissive intensity must be 0–${MAX_EMISSIVE_INTENSITY}` };
  }

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  const refusal = requireWritable(current, 'emissive');
  if (refusal) return { ok: false, error: refusal };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };
  (target as unknown as ColorRecord).emissiveIntensity = value;
  return { ok: true, material: target, value, copied: target !== current };
}

/**
 * Edits a material IN PLACE, affecting every object that shares it.
 *
 * This is the deliberate escape hatch from copy-on-write, and it is only
 * reachable when more than one object uses the material - otherwise "edit
 * shared" and "edit selected" are the same operation and offering a choice
 * would be noise.
 */
export function editSharedMaterial(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
): SlotResult {
  const material = slotMaterial(mesh, slot);
  if (!material) return { ok: false, error: 'That material slot is empty' };
  const users = working.countMaterialUsers(material);
  if (users <= 1) return { ok: false, error: 'This material is not shared' };
  return { ok: true, material };
}

/* -------------------------------------------------------------------------- */
/*                              Texture assignment                             */
/* -------------------------------------------------------------------------- */

export interface TextureAssignResult extends SlotResult {
  texture?: Texture;
  /** True when the previous texture was disposed. */
  releasedPrevious?: boolean;
}

/**
 * Assigns a texture to one material slot.
 *
 * The previous texture is released ONLY when the editor owns it AND nothing
 * else still reads it. An imported GLTF texture is never disposed here: it is
 * shared with the cache and with any other material that references it.
 *
 */
export function assignMaterialTexture(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  textureKey: TextureSlotKey,
  texture: Texture,
  options: { claim?: boolean; mode?: MaterialEditMode } = {},
): TextureAssignResult {
  const def = TEXTURE_SLOT_BY_KEY[textureKey];
  if (!def) return { ok: false, error: `Unknown texture slot: ${textureKey}` };
  if (!texture) return { ok: false, error: 'No texture to assign' };

  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  if (!materialCapabilities(current).textures) {
    return { ok: false, error: `${current.type} does not read textures` };
  }

  const target = resolveWriteTarget(working, mesh, slot, options.mode ?? 'selected');
  if (!target) return { ok: false, error: 'Could not edit that material' };

  // Colour space comes from the SLOT definition, so a caller cannot accidentally
  // sRGB-decode a normal map.
  configureTexture(texture, def);
  if (options.claim !== false) working.claimTexture(texture);

  const previous = (target as unknown as ColorRecord)[textureKey] as Texture | undefined;
  (target as unknown as ColorRecord)[textureKey] = texture;

  // Swapping a map changes the shader's sampler set; without this the material
  // keeps rendering with its old program and the new texture is invisible.
  target.needsUpdate = true;

  const releasedPrevious =
    !!previous && previous !== texture ? working.releaseTextureIfUnused(previous) : false;

  return {
    ok: true,
    material: target,
    texture,
    releasedPrevious,
    copied: target !== current,
  };
}

/** Clears one texture slot back to empty. */
export function clearMaterialTexture(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  textureKey: TextureSlotKey,
  mode: MaterialEditMode = 'selected',
): TextureAssignResult {
  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };

  const target = resolveWriteTarget(working, mesh, slot, mode);
  if (!target) return { ok: false, error: 'Could not edit that material' };

  const previous = (target as unknown as ColorRecord)[textureKey] as Texture | undefined;
  if (!previous) return { ok: true, material: target, copied: target !== current };

  (target as unknown as ColorRecord)[textureKey] = null;
  target.needsUpdate = true;

  const releasedPrevious = working.releaseTextureIfUnused(previous);
  return { ok: true, material: target, releasedPrevious, copied: target !== current };
}

/* -------------------------------------------------------------------------- */
/*                          Creation / assignment / reset                      */
/* -------------------------------------------------------------------------- */

/** Editor-created material defaults: matte, mostly dielectric, light grey. */
export const NEW_MATERIAL_DEFAULTS = {
  color: '#c8c8c8',
  roughness: 0.6,
  metalness: 0.05,
} as const;

/**
 * Creates a new editor-owned PBR material.
 *
 * Geometry and material are both claimed by the working scene so both are
 * disposed with it, exactly like a Stage 9C primitive.
 */
export function createEditorMaterial(working: WorkingScene, name?: string): Material {
  const material = new MeshStandardMaterial({
    color: new Color(NEW_MATERIAL_DEFAULTS.color),
    roughness: NEW_MATERIAL_DEFAULTS.roughness,
    metalness: NEW_MATERIAL_DEFAULTS.metalness,
  });
  working.claimMaterial(material);
  // Claimed BEFORE naming so the uniqueness scan sees this material among the
  // editor-created ones; otherwise two quick "New Material" clicks would both
  // resolve to the same name.
  working.nameEditorMaterial(material, (name ?? 'Material').trim() || 'Material');
  return material;
}

/**
 * Every material in the scene, de-duplicated by identity.
 *
 * One entry per material INSTANCE, not per slot: a material used by five meshes
 * is one assignable choice, and listing it five times would make the picker
 * unusable on a character model built from shared materials.
 */
export function sceneMaterials(working: WorkingScene): Material[] {
  const found: Material[] = [];
  const seen = new Set<Material>();
  working.root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh !== true) return;
    const material = mesh.material as Material | Material[] | undefined;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);
      found.push(entry);
    }
  });
  return found;
}

/** Names of every material currently used by the working scene. */
export function sceneMaterialNames(working: WorkingScene): string[] {
  return sceneMaterials(working)
    .map((material) => (typeof material.name === 'string' ? material.name.trim() : ''))
    .filter((name) => name.length > 0);
}

/**
 * Assigns a material to one slot.
 *
 * An index outside the mesh's existing slot range is refused: silently growing
 * a material array past its geometry groups would render the extra group with
 * the wrong material, or with none at all.
 */
export function assignMaterialToSlot(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
  material: Material,
): SlotResult {
  if (!material) return { ok: false, error: 'No material selected' };
  const total = slotCount(mesh);
  if (total === 0) {
    // A mesh with no material at all has one implicit slot.
    if (slot !== 0) return { ok: false, error: 'This mesh has no material slot' };
    mesh.material = working.claimMaterial(material);
    return { ok: true, material };
  }
  if (slot < 0 || slot >= total) {
    return { ok: false, error: `Slot ${slot} does not exist (this mesh has ${total})` };
  }

  const previous = slotMaterial(mesh, slot);
  if (previous === material) return { ok: true, material };

  if (!setSlotMaterial(mesh, slot, material)) {
    return { ok: false, error: 'Could not assign that material' };
  }
  working.releaseMaterialIfUnused(previous);
  return { ok: true, material };
}

/**
 * Duplicates the material at a slot so it can be edited independently.
 *
 * Textures stay SHARED with the source (cloning a material copies texture
 * references), so duplicating a material costs one material program, not a
 * second copy of every image already on the GPU.
 */
export function duplicateMaterial(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
): SlotResult {
  const current = slotMaterial(mesh, slot);
  if (!current) return { ok: false, error: 'That material slot is empty' };
  if (!materialCapabilities(current).editable) {
    const capabilities = materialCapabilities(current);
    return { ok: false, error: capabilities.reason ?? 'This material cannot be duplicated' };
  }

  const copy = current.clone();
  working.claimMaterial(copy);
  working.nameEditorMaterial(copy, `${current.name.trim() || 'Material'} Copy`);

  if (!setSlotMaterial(mesh, slot, copy)) return { ok: false, error: 'Could not duplicate' };
  return { ok: true, material: copy };
}

/** Renames an editor-managed material. */
export function renameMaterial(
  working: WorkingScene,
  material: Material,
  rawName: string,
): MaterialResult {
  const others = sceneMaterialNames(working).filter((name) => name !== material.name);
  const error = validateMaterialName(rawName, others);
  if (error) return { ok: false, error };

  material.name = rawName.trim();
  return { ok: true };
}

/**
 * Restores a material to its captured baseline.
 *
 * Restoring only writes properties the material's class actually has, so a
 * Basic material is not given a roughness it would ignore. Textures are put
 * back by reference; the texture being replaced is released afterwards only if
 * the editor owned it and nothing else reads it.
 */
export function resetMaterial(
  working: WorkingScene,
  mesh: Mesh,
  slot: number,
): SlotResult {
  const material = slotMaterial(mesh, slot);
  if (!material) return { ok: false, error: 'That material slot is empty' };

  const snapshot: MaterialSnapshot = working.snapshotOf(material);
  const capabilities = materialCapabilities(material);

  if (capabilities.color && snapshot.color) setColorHex(material, 'color', snapshot.color);
  if (capabilities.roughness && snapshot.roughness !== null) {
    (material as unknown as ColorRecord).roughness = snapshot.roughness;
  }
  if (capabilities.metalness && snapshot.metalness !== null) {
    (material as unknown as ColorRecord).metalness = snapshot.metalness;
  }
  if (capabilities.emissive && snapshot.emissive) {
    setColorHex(material, 'emissive', snapshot.emissive);
  }
  if (capabilities.emissive && snapshot.emissiveIntensity !== null) {
    (material as unknown as ColorRecord).emissiveIntensity = snapshot.emissiveIntensity;
  }

  material.opacity = snapshot.opacity;
  material.transparent = snapshot.transparent;
  material.depthWrite = snapshot.depthWrite;

  const replaced: Texture[] = [];
  for (const [key, texture] of Object.entries(snapshot.textures) as [TextureSlotKey, Texture][]) {
    const current = (material as unknown as ColorRecord)[key] as Texture | null | undefined;
    if (current === texture) continue;
    (material as unknown as ColorRecord)[key] = texture ?? null;
    if (current) replaced.push(current);
  }

  material.needsUpdate = true;

  // Released only after the restore, so liveness is judged in the final state.
  for (const texture of replaced) working.releaseTextureIfUnused(texture);

  return { ok: true, material };
}

/* -------------------------------------------------------------------------- */
/*                               Metadata helpers                              */
/* -------------------------------------------------------------------------- */

/** True when the object has more than one material slot. */
export function meshIsMultiMaterial(mesh: Mesh | null | undefined): boolean {
  return isMultiMaterial(mesh);
}