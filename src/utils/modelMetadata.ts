import { getFileExtension } from './validation';

export const MAX_UPLOAD_MB = 50;

export interface ModelFileStats {
  vertices: number | null;
  triangles: number | null;
  textures: number | null;
  animations: number | null;
}

export type MetadataResult =
  | { ok: true; stats: ModelFileStats }
  | { ok: false; error: string };

interface GltfPrimitive {
  attributes?: Record<string, number>;
  indices?: number;
  mode?: number;
}

interface GltfJson {
  asset?: { version?: string };
  meshes?: Array<{ primitives?: GltfPrimitive[] }>;
  accessors?: Array<{ count?: number }>;
  textures?: unknown[];
  images?: unknown[];
  animations?: unknown[];
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const MODE_TRIANGLES = 4;

function parseGlbJson(buffer: ArrayBuffer): unknown {
  if (buffer.byteLength < 20) {
    throw new Error('truncated');
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('bad magic');
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > buffer.byteLength) {
    throw new Error('truncated');
  }
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + chunkLength > buffer.byteLength) {
      throw new Error('truncated chunk');
    }
    if (chunkType === CHUNK_JSON) {
      const text = new TextDecoder().decode(
        new Uint8Array(buffer, offset, chunkLength),
      );
      return JSON.parse(text);
    }
    offset += chunkLength;
  }
  throw new Error('no JSON chunk');
}

function parseGltfText(text: string): unknown {
  const stripped = text.replace(/^\uFEFF/, '').trim();
  return JSON.parse(stripped);
}

function meshPrimitives(json: GltfJson): GltfPrimitive[] {
  const out: GltfPrimitive[] = [];
  for (const mesh of json.meshes ?? []) {
    if (mesh && Array.isArray(mesh.primitives)) {
      out.push(...mesh.primitives);
    }
  }
  return out;
}

function countStats(json: GltfJson): ModelFileStats {
  let vertices = 0;
  let triangles = 0;
  let countsBroken = false;

  const accessors = json.accessors;
  for (const primitive of meshPrimitives(json)) {
    const positionIndex = primitive.attributes?.POSITION;
    let positionCount: number | null = null;
    if (positionIndex !== undefined && positionIndex !== null) {
      const accessor = accessors?.[positionIndex];
      positionCount =
        typeof accessor?.count === 'number' ? accessor.count : null;
    }
    if (positionCount === null) {
      if (positionIndex !== undefined && positionIndex !== null) {
        countsBroken = true;
      }
    } else {
      vertices += positionCount;
    }

    const mode = primitive.mode ?? MODE_TRIANGLES;
    if (mode === MODE_TRIANGLES) {
      if (primitive.indices !== undefined && primitive.indices !== null) {
        const indexAccessor = accessors?.[primitive.indices];
        if (typeof indexAccessor?.count === 'number') {
          triangles += Math.floor(indexAccessor.count / 3);
        } else {
          countsBroken = true;
        }
      } else if (positionCount !== null) {
        triangles += Math.floor(positionCount / 3);
      }
    }
  }

  let textures: number | null;
  if (Array.isArray(json.textures)) {
    textures = json.textures.length;
  } else if (Array.isArray(json.images)) {
    textures = json.images.length;
  } else {
    textures = 0;
  }

  return {
    vertices: countsBroken ? null : vertices,
    triangles: countsBroken ? null : triangles,
    textures,
    animations: Array.isArray(json.animations) ? json.animations.length : 0,
  };
}

export async function extractModelMetadata(
  file: File,
): Promise<MetadataResult> {
  const format = getFileExtension(file.name);
  if (!format) {
    return { ok: false, error: 'Only GLB and GLTF files are allowed' };
  }

  try {
    const json =
      format === 'glb'
        ? parseGlbJson(await file.arrayBuffer())
        : parseGltfText(await file.text());

    if (
      json === null ||
      typeof json !== 'object' ||
      !('asset' in json) ||
      !(json as GltfJson).asset
    ) {
      return {
        ok: false,
        error: 'This file could not be read as a glTF model',
      };
    }

    return { ok: true, stats: countStats(json as GltfJson) };
  } catch {
    return { ok: false, error: 'This file could not be read as a glTF model' };
  }
}
