import type { TextureSlotKey } from '../materials';
import type { PrimitiveKind, PrimitiveParams } from '../primitives';

/**
 * Versioned project document.
 *
 * ================================ WHY A VERSION FIELD ================================
 * A saved project outlives the code that wrote it. `formatVersion` is checked on
 * load so a future format change can migrate old documents instead of silently
 * mis-reading them - and so a document written by a NEWER build is refused with
 * a clear message rather than restoring a scene that has lost fields.
 *
 * The document is plain JSON plus a separate binary side-channel for texture
 * pixels. Textures are deliberately NOT inlined as data URLs: a base64 PNG costs
 * a third more than the bytes it encodes, and several textures per material
 * quickly exceed what a JSON document should carry.
 * =======================================================================================
 */

/** Current format. Bump when a field changes meaning, and add a migration. */
export const PROJECT_FORMAT_VERSION = 1;

/** Formats this build can read. */
export const SUPPORTED_PROJECT_VERSIONS = [1];

export interface ProjectFormatError {
  ok: false;
  error: string;
}

export type FormatResult<T> = { ok: true; value: T } | ProjectFormatError;

/** A node in the saved hierarchy. */
export interface ProjectNode {
  id: string;
  name: string;
  visible: boolean;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
  /** Sibling slot, so a restored scene keeps the author's ordering. */
  index: number;
  /** Present on editor-created primitives only. */
  primitive?: { kind: PrimitiveKind; params: PrimitiveParams };
  /** One entry per material slot. Absent for nodes that are not meshes. */
  materials?: (ProjectMaterial | null)[];
  children: ProjectNode[];
}

/** A material as stored in a project. */
export interface ProjectMaterial {
  /** Stable within the document; materials are shared by reference. */
  key: string;
  name: string;
  /** The three.js material class, so a reload rebuilds the same type. */
  type: string;
  color?: string | null;
  roughness?: number | null;
  metalness?: number | null;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  emissive?: string | null;
  emissiveIntensity?: number | null;
  /** Texture slot -> texture key in `textures`. */
  textures?: Partial<Record<TextureSlotKey, string>>;
}

/** A texture as stored in a project. */
export interface ProjectTexture {
  key: string;
  /** Original file name, for the inspector readout after a reload. */
  name: string;
  width: number;
  height: number;
  colorSpace: string;
  /** Encoded image bytes. */
  data: Blob;
}

export interface ProjectDocument {
  formatVersion: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** The source asset this project was built from, if any. */
  source: {
    modelId: string | null;
    modelName: string | null;
    fileUrl: string | null;
  } | null;
  /** Materials by key, so sharing is preserved exactly. */
  materials: Record<string, ProjectMaterial>;
  /** Textures by key; binary payloads live here. */
  textures: Record<string, ProjectTexture>;
  /** Top-level nodes under the working-scene root. */
  nodes: ProjectNode[];
}

/** The subset of a document that survives structured clone / JSON checks. */
export function isProjectDocument(value: unknown): value is ProjectDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectDocument>;
  return (
    typeof candidate.formatVersion === 'number' &&
    typeof candidate.id === 'string' &&
    Array.isArray(candidate.nodes) &&
    typeof candidate.materials === 'object' &&
    candidate.materials !== null &&
    typeof candidate.textures === 'object' &&
    candidate.textures !== null
  );
}

/**
 * Validates a document before it is trusted.
 *
 * Refusing a wrong-version document is deliberate: half-applying a document
 * whose shape we do not understand would leave the user with a corrupted scene
 * and no way back.
 */
export function validateProjectDocument(value: unknown): FormatResult<ProjectDocument> {
  if (!isProjectDocument(value)) {
    return { ok: false, error: 'That file is not a saved studio project' };
  }
  if (!SUPPORTED_PROJECT_VERSIONS.includes(value.formatVersion)) {
    return {
      ok: false,
      error:
        value.formatVersion > PROJECT_FORMAT_VERSION
          ? `This project was saved by a newer version of the studio (format ${value.formatVersion})`
          : `This project uses an unsupported format version (${value.formatVersion})`,
    };
  }
  return { ok: true, value };
}

/** Builds an empty, well-formed document. */
export function emptyProjectDocument(id: string, name: string): ProjectDocument {
  const now = Date.now();
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    source: null,
    materials: {},
    textures: {},
    nodes: [],
  };
}

/** A filesystem-safe, human-readable file name for an export or download. */
export function safeFileName(name: string, extension: string): string {
  const base = name
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${base || 'project'}${extension}`;
}