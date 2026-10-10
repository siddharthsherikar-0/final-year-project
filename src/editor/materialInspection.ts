import type { Material, Mesh, Texture } from 'three';
import type { WorkingScene } from './workingScene';
import {
  TEXTURE_SLOTS,
  materialCapabilities,
  slotCount,
  slotDisplayName,
  slotMaterial,
  textureFileName,
  textureSize,
  type MaterialCapabilities,
  type TextureSlotKey,
} from './materials';

/**
 * Material inspection view model.
 *
 * The inspector needs to render the material of a live three.js object, but
 * Zustand and React must never hold a `Material`, `Color` or `Texture`. This
 * module derives a plain-data view model on demand - exactly like
 * `TransformInspector` derives transform numbers - and returns only strings,
 * numbers and booleans.
 *
 * It is recomputed on every render, keyed on the caller's epoch, so a value can
 * never be stale: there is no mirrored copy to fall out of sync.
 */

export interface InspectedTextureSlot {
  key: TextureSlotKey;
  label: string;
  hint: string;
  /** True when a texture is assigned to this slot. */
  populated: boolean;
  /** Source file name, when the texture came from a file. */
  fileName: string | null;
  width: number | null;
  height: number | null;
  /** True when the editor owns this texture and may dispose it. */
  editorOwned: boolean;
  /** Correct colour space for this slot, for display. */
  colorSpace: 'srgb' | 'data';
}

export interface InspectedMaterialSlot {
  /** Slot index within the mesh's material array. */
  index: number;
  /** Display name including the slot suffix for multi-material meshes. */
  label: string;
  /** Raw material name, or '' when the asset did not name it. */
  name: string;
  capabilities: MaterialCapabilities;
  /** `#rrggbb`, or null when the class has no colour. */
  color: string | null;
  roughness: number | null;
  metalness: number | null;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissive: string | null;
  emissiveIntensity: number | null;
  /** True when more than one object uses this material instance. */
  shared: boolean;
  /** How many slots across the scene reference this material. */
  userCount: number;
  /** True when the editor owns and may dispose this material. */
  editorOwned: boolean;
  textures: InspectedTextureSlot[];
}

export interface MaterialInspection {
  /** Total slot count on the mesh (1 for single-material meshes). */
  slotCount: number;
  multiMaterial: boolean;
  /** The slot the inspector is currently showing. */
  activeSlot: number;
  slots: InspectedMaterialSlot[];
}

type ColorRecord = Record<string, unknown>;

function readHex(material: Material, key: string): string | null {
  const value = (material as unknown as ColorRecord)[key];
  const candidate = value as { isColor?: boolean; getHexString?: (space?: string) => string } | undefined;
  if (candidate?.isColor !== true || typeof candidate.getHexString !== 'function') return null;
  return `#${candidate.getHexString('srgb')}`;
}

function readNumber(material: Material, key: string): number | null {
  const value = (material as unknown as ColorRecord)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inspectTextureSlot(
  working: WorkingScene,
  material: Material,
  key: TextureSlotKey,
): InspectedTextureSlot {
  const def = TEXTURE_SLOTS.find((entry) => entry.key === key);
  const texture = (material as unknown as ColorRecord)[key] as Texture | null | undefined;
  const populated = !!texture && (texture as { isTexture?: boolean }).isTexture === true;
  const size = populated ? textureSize(texture) : null;

  return {
    key,
    label: def?.label ?? key,
    hint: def?.hint ?? '',
    populated,
    fileName: populated ? textureFileName(texture) : null,
    width: size ? size[0] : null,
    height: size ? size[1] : null,
    editorOwned: populated ? working.ownsTexture(texture) : false,
    colorSpace: def?.colorSpace ?? 'data',
  };
}

/**
 * Describes one material slot.
 *
 * `userCount` deliberately counts the ACTIVE slot as a user, so a material used
 * by exactly this one slot reports 1 (not shared) while a material used by two
 * slots on the same mesh reports 2. That distinction matters: editing a
 * multi-material mesh's slot 0 must not restyle slot 1.
 */
function inspectSlot(
  working: WorkingScene,
  mesh: Mesh,
  index: number,
): InspectedMaterialSlot | null {
  const material = slotMaterial(mesh, index);
  if (!material) return null;

  const capabilities = materialCapabilities(material);
  const total = slotCount(mesh);
  const userCount = working.countMaterialUsers(material);

  return {
    index,
    label: slotDisplayName(material, index, total),
    name: typeof material.name === 'string' ? material.name.trim() : '',
    capabilities,
    color: capabilities.color ? readHex(material, 'color') : null,
    roughness: capabilities.roughness ? readNumber(material, 'roughness') : null,
    metalness: capabilities.metalness ? readNumber(material, 'metalness') : null,
    opacity: typeof material.opacity === 'number' ? material.opacity : 1,
    transparent: material.transparent === true,
    depthWrite: material.depthWrite !== false,
    emissive: capabilities.emissive ? readHex(material, 'emissive') : null,
    emissiveIntensity: capabilities.emissive ? readNumber(material, 'emissiveIntensity') : null,
    shared: userCount > 1,
    userCount,
    editorOwned: working.ownedMaterials.has(material),
    textures: capabilities.textures
      ? TEXTURE_SLOTS.map((slot) => inspectTextureSlot(working, material, slot.key))
      : [],
  };
}

/**
 * Describes every material slot on a mesh.
 *
 * `activeSlot` is clamped into range rather than trusted: after a delete the
 * selection may resolve to a mesh with fewer slots than the inspector last
 * showed, and an out-of-range index would render the panel blank.
 */
export function inspectMaterials(
  working: WorkingScene | null,
  mesh: Mesh | null | undefined,
  requestedSlot = 0,
): MaterialInspection | null {
  if (!working || !mesh || mesh.isMesh !== true) return null;

  const total = slotCount(mesh);
  if (total === 0) {
    return { slotCount: 0, multiMaterial: false, activeSlot: 0, slots: [] };
  }

  const activeSlot = Math.min(Math.max(Math.trunc(requestedSlot), 0), total - 1);
  const slots: InspectedMaterialSlot[] = [];
  for (let index = 0; index < total; index += 1) {
    const inspected = inspectSlot(working, mesh, index);
    if (inspected) slots.push(inspected);
  }

  return { slotCount: total, multiMaterial: total > 1, activeSlot, slots };
}

/** Counts populated texture slots across one material, for a compact summary. */
export function populatedTextureCount(slot: InspectedMaterialSlot | null | undefined): number {
  if (!slot) return 0;
  return slot.textures.filter((texture) => texture.populated).length;
}

/** Compact list of the populated slot labels, e.g. `Base Color, Normal`. */
export function populatedTextureLabels(slot: InspectedMaterialSlot | null | undefined): string[] {
  if (!slot) return [];
  return slot.textures.filter((texture) => texture.populated).map((texture) => texture.label);
}