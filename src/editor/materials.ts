import type { Material, Mesh, Texture } from 'three';

/**
 * Material model for Stage 9D.
 *
 * Everything here is either a plain function over a live `Material` or pure
 * serialisable data. No three.js instance ever reaches React or Zustand: the
 * inspector derives its view model from the live material during render (see
 * `materialInspection.ts`) and only ever publishes strings and numbers.
 *
 * Two rules drive the whole design:
 *
 *  1. Which properties exist depends on the material CLASS. A glTF asset can
 *     legitimately contain `MeshBasicMaterial` (no roughness, no metalness) or
 *     `MeshLambertMaterial` (no roughness, but it does have emissive). The
 *     inspector therefore asks for capabilities and disables what the material
 *     cannot honour, instead of silently writing a property that nothing reads.
 *
 *  2. Texture slots are DATA in a different colour space to colour maps. Base
 *     colour and emissive maps are sRGB; normal, roughness, metalness and
 *     ambient-occlusion maps are numeric data and must never be sRGB-decoded -
 *     doing so visibly corrupts the surface, so the correct colour space is
 *     derived from the slot rather than guessed by the caller.
 */

export type TextureSlotKey =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'emissiveMap'
  | 'aoMap';

export type TextureColorSpace = 'srgb' | 'data';

export interface TextureSlotDef {
  key: TextureSlotKey;
  label: string;
  colorSpace: TextureColorSpace;
  /** One-line explanation shown as the field's tooltip. */
  hint: string;
}

/** The six texture slots Stage 9D supports, in inspector order. */
export const TEXTURE_SLOTS: readonly TextureSlotDef[] = [
  {
    key: 'map',
    label: 'Base Color',
    colorSpace: 'srgb',
    hint: 'Albedo / diffuse colour of the surface',
  },
  {
    key: 'normalMap',
    label: 'Normal',
    colorSpace: 'data',
    hint: 'Tangent-space normal data. Never colour-decoded.',
  },
  {
    key: 'roughnessMap',
    label: 'Roughness',
    colorSpace: 'data',
    hint: 'Per-pixel roughness. Green channel.',
  },
  {
    key: 'metalnessMap',
    label: 'Metalness',
    colorSpace: 'data',
    hint: 'Per-pixel metalness. Blue channel.',
  },
  {
    key: 'emissiveMap',
    label: 'Emissive',
    colorSpace: 'srgb',
    hint: 'Self-illumination colour, modulated by intensity',
  },
  {
    key: 'aoMap',
    label: 'Ambient Occlusion',
    colorSpace: 'data',
    hint: 'Occlusion from the second UV set',
  },
] as const;

export const TEXTURE_SLOT_KEYS = TEXTURE_SLOTS.map((slot) => slot.key);

/** Emissive intensity above 1 is legitimate HDR bloom, but unbounded input is not. */
export const MAX_EMISSIVE_INTENSITY = 10;

export type TextureSlotDefByKey = Record<TextureSlotKey, TextureSlotDef>;

/** Lookup by key, so a caller never has to search the array. */
export const TEXTURE_SLOT_BY_KEY: TextureSlotDefByKey = TEXTURE_SLOTS.reduce(
  (accumulator, slot) => {
    accumulator[slot.key] = slot;
    return accumulator;
  },
  {} as TextureSlotDefByKey,
);

/**
 * Which PBR properties a material class actually honours.
 *
 * `editable` means "the editor can safely build a copy-on-write clone of this
 * material", which is a question about the class rather than the instance.
 */
export interface MaterialCapabilities {
  type: string;
  /** Human label, e.g. `PBR` or `Unlit`. */
  family: 'PBR' | 'Unlit' | 'Phong' | 'Toon' | 'Unsupported';
  color: boolean;
  roughness: boolean;
  metalness: boolean;
  opacity: boolean;
  emissive: boolean;
  /** Texture slots this class reads. */
  textures: boolean;
  /** True when copy-on-write cloning is supported for this class. */
  editable: boolean;
  /** Why editing is unavailable, when it is. */
  reason?: string;
}

const UNSUPPORTED_REASON =
  'This material class does not expose PBR properties the editor can edit.';

export function materialCapabilities(material: Material | null | undefined): MaterialCapabilities {
  const type = material?.type ?? 'Material';
  if (!material) {
    return {
      type,
      family: 'Unsupported',
      color: false,
      roughness: false,
      metalness: false,
      opacity: false,
      emissive: false,
      textures: false,
      editable: false,
      reason: 'No material',
    };
  }

  // three does not export the physical/standard distinction through a stable
  // public flag on every build, so the capability table keys off the type name.
  switch (type) {
    case 'MeshStandardMaterial':
    case 'MeshPhysicalMaterial':
      return {
        type,
        family: 'PBR',
        color: true,
        roughness: true,
        metalness: true,
        opacity: true,
        emissive: true,
        textures: true,
        editable: true,
      };
    case 'MeshBasicMaterial':
      return {
        type,
        family: 'Unlit',
        color: true,
        roughness: false,
        metalness: false,
        opacity: true,
        emissive: false,
        textures: true,
        editable: true,
      };
    case 'MeshPhongMaterial':
    case 'MeshLambertMaterial':
      return {
        type,
        family: 'Phong',
        color: true,
        roughness: false,
        metalness: false,
        opacity: true,
        emissive: true,
        textures: true,
        editable: true,
      };
    case 'MeshToonMaterial':
      return {
        type,
        family: 'Toon',
        color: true,
        roughness: false,
        metalness: false,
        opacity: true,
        emissive: false,
        textures: true,
        editable: true,
      };
    default:
      return {
        type,
        family: 'Unsupported',
        color: false,
        roughness: false,
        metalness: false,
        opacity: false,
        emissive: false,
        textures: false,
        editable: false,
        reason: UNSUPPORTED_REASON,
      };
  }
}

/** True when the class supports the full PBR editing surface. */
export function isPbrMaterial(material: Material | null | undefined): boolean {
  return materialCapabilities(material).family === 'PBR';
}

/* -------------------------------------------------------------------------- */
/*                                  Validation                                 */
/* -------------------------------------------------------------------------- */

export type HexResult = { ok: true; hex: string } | { ok: false; error: string };

/**
 * Normalises user hex input to `#rrggbb` (lower case).
 *
 * Accepts `#abc`, `abc`, `#aabbcc` and `AABBCC`, with surrounding whitespace.
 * Rejects every other shape rather than letting `Color.setStyle` throw or,
 * worse, quietly resolve to black.
 */
export function normalizeHex(input: string): HexResult {
  const trimmed = input.trim().replace(/^#/, '');
  if (trimmed.length === 3 && /^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.split('');
    return { ok: true, hex: `#${r}${r}${g}${g}${b}${b}`.toLowerCase() };
  }
  if (trimmed.length === 6 && /^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return { ok: true, hex: `#${trimmed}`.toLowerCase() };
  }
  return { ok: false, error: 'Enter a hex colour like #c8c8c8' };
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input).ok;
}

/** Clamps a scalar PBR factor into 0..1, rejecting non-finite input. */
export function clampUnit(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Clamps a non-negative scalar such as emissive intensity. */
export function clampNonNegative(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

/** Rounds for display without producing float noise like 0.30000000000000004. */
export function roundScalar(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* -------------------------------------------------------------------------- */
/*                             Slot access helpers                             */
/* -------------------------------------------------------------------------- */

export function slotCount(mesh: Mesh | null | undefined): number {
  const material = mesh?.material as Material | Material[] | undefined;
  if (!material) return 0;
  return Array.isArray(material) ? material.length : 1;
}

export function isMultiMaterial(mesh: Mesh | null | undefined): boolean {
  return slotCount(mesh) > 1;
}

/** Reads one material slot. Returns null for an out-of-range or empty slot. */
export function slotMaterial(mesh: Mesh | null | undefined, slot: number): Material | null {
  const material = mesh?.material as Material | Material[] | undefined;
  if (!material) return null;
  if (Array.isArray(material)) {
    const entry = material[slot];
    return entry ?? null;
  }
  return slot === 0 ? material : null;
}

/**
 * Writes one material slot IN PLACE.
 *
 * The array form is mutated rather than replaced so geometry groups and
 * material indices keep their correspondence; assigning a new array would be
 * equally valid for three but hides accidental length changes.
 *
 * Refuses out-of-range indices so a multi-material mesh can never be collapsed
 * to a single slot by a bad index.
 */
export function setSlotMaterial(
  mesh: Mesh | null | undefined,
  slot: number,
  material: Material,
): boolean {
  const current = mesh?.material as Material | Material[] | undefined;
  if (!current || !material) return false;

  if (Array.isArray(current)) {
    if (slot < 0 || slot >= current.length) return false;
    current[slot] = material;
    return true;
  }
  if (slot !== 0) return false;
  mesh!.material = material;
  return true;
}

/** True when `material` is referenced by any slot of `mesh`. */
export function meshUsesMaterial(mesh: Mesh, material: Material): boolean {
  const current = mesh.material as Material | Material[] | undefined;
  if (!current) return false;
  if (Array.isArray(current)) return current.includes(material);
  return current === material;
}

/* -------------------------------------------------------------------------- */
/*                                  Snapshots                                  */
/* -------------------------------------------------------------------------- */

/**
 * The captured "as found" state of a material, used by Reset.
 *
 * Captured the moment the editor takes ownership - at scene creation for an
 * imported material, and at creation for an editor-made one - so Reset always
 * returns to the values the asset actually shipped with, never to a later
 * arbitrary point.
 */
export interface MaterialSnapshot {
  /** `#rrggbb`, or null when the class has no colour. */
  color: string | null;
  roughness: number | null;
  metalness: number | null;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissive: string | null;
  emissiveIntensity: number | null;
  /** Original texture per populated slot. */
  textures: Partial<Record<TextureSlotKey, Texture>>;
}

type MutableRecord = Record<string, unknown>;

function readColorHex(material: Material, key: string): string | null {
  const value = (material as unknown as MutableRecord)[key];
  const candidate = value as { isColor?: boolean; getHexString?: (space?: string) => string } | undefined;
  if (candidate?.isColor !== true || typeof candidate.getHexString !== 'function') return null;
  // Read back in sRGB: that is the space the user typed the hex in.
  return `#${candidate.getHexString('srgb')}`;
}

function readNumber(material: Material, key: string): number | null {
  const value = (material as unknown as MutableRecord)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}



/**
 * Captures the current state of a material.
 *
 * Only properties the material's class actually has are recorded, so restoring
 * a snapshot never writes a meaningless field.
 */
export function captureMaterialSnapshot(material: Material): MaterialSnapshot {
  const capabilities = materialCapabilities(material);
  const textures: Partial<Record<TextureSlotKey, Texture>> = {};
  for (const slot of TEXTURE_SLOTS) {
    const texture = (material as unknown as MutableRecord)[slot.key];
    if (texture && (texture as { isTexture?: boolean }).isTexture === true) {
      textures[slot.key] = texture as Texture;
    }
  }

  return {
    color: capabilities.color ? readColorHex(material, 'color') : null,
    roughness: capabilities.roughness ? readNumber(material, 'roughness') : null,
    metalness: capabilities.metalness ? readNumber(material, 'metalness') : null,
    opacity: typeof material.opacity === 'number' ? material.opacity : 1,
    // `transparent` is not a per-class capability: every material the editor
      // can reach honours it, and it is the switch that makes opacity visible.
      transparent: material.transparent === true,
    depthWrite: material.depthWrite !== false,
    emissive: capabilities.emissive ? readColorHex(material, 'emissive') : null,
    emissiveIntensity: capabilities.emissive ? readNumber(material, 'emissiveIntensity') : null,
    textures,
  };
}

/** Name for a slot, used in the inspector when the asset did not name it. */
export function slotDisplayName(material: Material, slot: number, total: number): string {
  const name = typeof material.name === 'string' ? material.name.trim() : '';
  if (total > 1) return name ? `${name} · slot ${slot}` : `Slot ${slot}`;
  return name || 'Unnamed material';
}

/** Names for editor-managed materials must be unique and non-empty. */
export function validateMaterialName(raw: string, taken: readonly string[]): string | null {
  const name = raw.trim();
  if (!name) return 'Name cannot be empty';
  if (name.length > 64) return 'Name is too long';
  const lowered = name.toLowerCase();
  if (taken.some((entry) => entry.toLowerCase() === lowered)) return 'That name is already in use';
  return null;
}

/**
 * Extracts a readable label for a texture.
 *
 * `Texture.name` is checked first because it is the only field the editor
 * controls directly. Failing that, a loader-created texture keeps its source
 * URL on `image.src` (three's `load` assigns it), so the file name is recovered
 * from the path - including for object URLs, which is why an editor-loaded
 * texture can still show which file it came from.
 *
 * Returns null only when there is genuinely nothing to show.
 */
export function textureFileName(texture: Texture | null | undefined): string | null {
  if (!texture) return null;
  if (typeof texture.name === 'string' && texture.name.trim()) return texture.name.trim();

  const image = texture.image as { src?: unknown } | undefined;
  const src = image?.src;
  if (typeof src !== 'string' || !src) return null;

  // `data:` URLs carry the bytes inline; showing the prefix is noise.
  if (src.startsWith('data:')) return 'Embedded image';

  // Blob URLs are `blob:<origin>/<uuid>`; the uuid is not a useful label, but
  // the object URL is the only identity an editor-loaded texture has at this
  // point, so it is truncated into something honest rather than hidden.
  if (src.startsWith('blob:')) {
    const tail = src.slice(src.lastIndexOf('/') + 1);
    return tail.length > 0 ? `blob:${tail.slice(0, 8)}` : 'Local image';
  }

  const segments = src.split('/');
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? decodeURIComponent(last) : null;
}

/** Reads a texture's pixel size, when the image has already been decoded. */
export function textureSize(texture: Texture | null | undefined): [number, number] | null {
  const image = texture?.image as { width?: unknown; height?: unknown } | undefined;
  const width = image?.width;
  const height = image?.height;
  if (typeof width !== 'number' || typeof height !== 'number') return null;
  if (width <= 0 || height <= 0) return null;
  return [width, height];
}