import { Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, MeshToonMaterial, MeshPhysicalMaterial, MeshMatcapMaterial, MeshNormalMaterial, MeshDepthMaterial, MeshDistanceMaterial, ShaderMaterial } from 'three';
import type { Material, Object3D, Texture } from 'three';
import type { WorkingScene } from '../workingScene';
import {
  TEXTURE_SLOT_KEYS,
  captureMaterialSnapshot,
  type TextureSlotKey,
} from '../materials';
import { readPrimitiveMeta } from '../primitives';
import {
  PROJECT_FORMAT_VERSION,
  type ProjectDocument,
  type ProjectMaterial,
  type ProjectNode,
  type ProjectTexture,
} from './projectFormat';

/**
 * Scene <-> project document.
 *
 * The scene is serialised by WALKING the live graph, never by reading editor
 * state, because the graph is the truth. Editing state (history, selection,
 * epochs) is deliberately not saved: a reopened project starts with a clean
 * slate and its own undo history, which is what a user expects from opening a
 * file rather than resuming a session.
 *
 * Only EDITOR-MODIFIED resources need saving. An imported GLTF's geometry and
 * textures still live in the shared loader cache and are reconstructed from the
 * source asset on load, so a project stores the source reference plus the edits
 * layered on top.
 */

function materialTypeOf(material: Material): string {
  return material.type ?? material.constructor?.name ?? 'MeshStandardMaterial';
}

/** Rebuilds a material of the saved class, so a reload keeps its behaviour. */
function instantiateMaterial(type: string): Material {
  switch (type) {
    case 'MeshBasicMaterial':
      return new MeshBasicMaterial();
    case 'MeshLambertMaterial':
      return new MeshLambertMaterial();
    case 'MeshPhongMaterial':
      return new MeshPhongMaterial();
    case 'MeshToonMaterial':
      return new MeshToonMaterial();
    case 'MeshMatcapMaterial':
      return new MeshMatcapMaterial();
    case 'MeshNormalMaterial':
      return new MeshNormalMaterial();
    case 'MeshDepthMaterial':
      return new MeshDepthMaterial();
    case 'MeshDistanceMaterial':
      return new MeshDistanceMaterial();
    case 'MeshPhysicalMaterial':
      return new MeshPhysicalMaterial();
    case 'ShaderMaterial':
      return new ShaderMaterial();
    default:
      return new MeshStandardMaterial();
  }
}

function readHex(material: Material, key: 'color' | 'emissive'): string | null {
  const value = (material as unknown as Record<string, unknown>)[key];
  const candidate = value as { isColor?: boolean; getHexString?: (space?: string) => string } | undefined;
  if (candidate?.isColor !== true || typeof candidate.getHexString !== 'function') return null;
  return `#${candidate.getHexString('srgb')}`;
}

/** Exported for the material inspector, which shows the same values. */
export { readHex };

function isMesh(value: Object3D): value is Mesh {
  return (value as Mesh).isMesh === true;
}

/** Material slots of a mesh as a flat, index-preserving list. */
function slotsOf(mesh: Mesh): (Material | null)[] {
  const material = mesh.material as Material | Material[] | undefined;
  if (!material) return [null];
  if (Array.isArray(material)) return material;
  return [material];
}

/**
 * Serialises one material into a shareable record.
 *
 * Materials are keyed so that two meshes using the SAME material serialise to
 * ONE record and reload as one shared instance - the scene's sharing semantics
 * are part of the project, not a rendering detail.
 */
function serialiseMaterial(
  working: WorkingScene,
  material: Material,
  materials: Record<string, ProjectMaterial>,
  captureTexture: (texture: Texture) => string,
): ProjectMaterial {
  const key = working.materialId(material) ?? (material.name || materialTypeOf(material));
  const existing = materials[key];
  if (existing) return existing;

  const snapshot = captureMaterialSnapshot(material);
  const record: ProjectMaterial = {
    key,
    name: typeof material.name === 'string' ? material.name : '',
    type: materialTypeOf(material),
    color: snapshot.color,
    roughness: snapshot.roughness,
    metalness: snapshot.metalness,
    opacity: snapshot.opacity,
    transparent: snapshot.transparent,
    depthWrite: snapshot.depthWrite,
    emissive: snapshot.emissive,
    emissiveIntensity: snapshot.emissiveIntensity,
  };

  const bag = material as unknown as Record<string, Texture | null>;
  const slots: Partial<Record<TextureSlotKey, string>> = {};
  for (const slotKey of TEXTURE_SLOT_KEYS) {
    const texture = bag[slotKey];
    if (!texture) continue;
    slots[slotKey] = captureTexture(texture);
  }
  if (Object.keys(slots).length > 0) record.textures = slots;

  materials[key] = record;
  return record;
}

function serialiseNode(
  working: WorkingScene,
  object: Object3D,
  index: number,
  materials: Record<string, ProjectMaterial>,
  captureTexture: (texture: Texture) => string,
): ProjectNode {
  const id = working.registry.idOf(object) ?? '';
  const node: ProjectNode = {
    id,
    name: typeof object.name === 'string' ? object.name : '',
    visible: object.visible,
    position: [object.position.x, object.position.y, object.position.z],
    quaternion: [
      object.quaternion.x,
      object.quaternion.y,
      object.quaternion.z,
      object.quaternion.w,
    ],
    scale: [object.scale.x, object.scale.y, object.scale.z],
    index,
    children: [],
  };

  if (isMesh(object)) {
    const meta = readPrimitiveMeta(object);
    if (meta) node.primitive = { kind: meta.kind, params: { ...meta.params } };

    node.materials = slotsOf(object).map((material) =>
      material ? serialiseMaterial(working, material, materials, captureTexture) : null,
    );
  }

  node.children = object.children.map((child, childIndex) =>
    serialiseNode(working, child, childIndex, materials, captureTexture),
  );
  return node;
}

/**
 * Injects how a live texture becomes a storable record.
 *
 * Kept as an explicit parameter rather than assumed inside the walker, because
 * the caller decides the policy: an editor-loaded texture holds decoded pixels
 * that must be RE-ENCODED to be stored, while an imported GLTF texture is not
 * stored at all because the source asset already contains it.
 */
export interface SerialiseOptions {
  /**
   * Registers a texture so it can be referenced by key.
   *
   * Returns the key synchronously because the walker is synchronous, while the
   * caller's actual encoding is asynchronous. The callback returns void and the
   * caller fills its texture table in as each encode resolves, which is why the
   * document is only complete once the caller has awaited its own work.
   */
  storeTexture?: (key: string, texture: Texture) => void;
}

export interface SerialiseResult {
  materials: Record<string, ProjectMaterial>;
  textures: Record<string, ProjectTexture>;
  nodes: ProjectNode[];
}

/**
 * Walks the working scene and produces the editable parts of a document.
 *
 * Bones, the selection outline and other rig infrastructure are skipped: they are
 * rebuilt from the source asset when the project reloads, and saving them would
 * duplicate data the source file already holds.
 */
export function serialiseWorkingScene(
  working: WorkingScene,
  storeTexture?: (key: string, texture: Texture) => void,
): SerialiseResult {
  const materials: Record<string, ProjectMaterial> = {};

  const capture = (texture: Texture): string => {
    const key = working.textureId(texture);
    if (!key) return '';
    storeTexture?.(key, texture);
    return key;
  };

  const nodes = working.root.children.map((child, index) =>
    serialiseNode(working, child, index, materials, capture),
  );

  // Texture payloads are filled in by the caller's asynchronous encoder; the keys
  // are already referenced by the material records at this point.
  return { materials, textures: {}, nodes };
}

/** Applies a serialised material record onto a live material instance. */
export function applyProjectMaterial(material: Material, record: ProjectMaterial): void {
  const bag = material as unknown as Record<string, unknown>;

  for (const key of ['color', 'emissive'] as const) {
    const hex = record[key];
    const color = bag[key] as { set: (value: string) => void } | undefined;
    if (typeof hex === 'string' && color) color.set(hex);
  }
  for (const key of ['roughness', 'metalness', 'emissiveIntensity'] as const) {
    const value = record[key];
    if (typeof value === 'number') bag[key] = value;
  }
  if (typeof record.opacity === 'number') bag.opacity = record.opacity;
  if (typeof record.transparent === 'boolean') bag.transparent = record.transparent;
  if (typeof record.depthWrite === 'boolean') bag.depthWrite = record.depthWrite;
  if (typeof record.name === 'string') material.name = record.name;

  material.needsUpdate = true;
}

export interface RestoreTextures {
  /** Resolves a texture key to a live texture, or null when unavailable. */
  resolve: (key: string) => Texture | null;
}

/** Builds live material instances from the document's material table. */
export function restoreMaterials(
  record: ProjectDocument['materials'],
  textures: RestoreTextures,
): Map<string, Material> {
  const materials = new Map<string, Material>();

  for (const [key, entry] of Object.entries(record)) {
    const material = instantiateMaterial(entry.type);
    applyProjectMaterial(material, entry);

    const bag = material as unknown as Record<string, Texture | null>;
    for (const [slotKey, textureKey] of Object.entries(entry.textures ?? {})) {
      if (!textureKey) continue;
      const texture = textures.resolve(textureKey);
      if (texture) bag[slotKey] = texture;
    }
    material.needsUpdate = true;
    materials.set(key, material);
  }

  return materials;
}

/** True when a document's version can be read by this build. */
export function isReadableFormat(version: number): boolean {
  return version <= PROJECT_FORMAT_VERSION;
}