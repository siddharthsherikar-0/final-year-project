import { Box3, Vector3 } from 'three';
import type { Material, Mesh, Object3D } from 'three';
import type { AnimationClip } from 'three';

/**
 * Studio scene inspection.
 *
 * Derives everything the Studio's inspection panel shows from the scene that
 * is *already loaded and rendered* - there is no second GLTF fetch and no
 * extra WebGL context. The result is plain serialisable data so it can be
 * asserted in jsdom (three core needs no GL context) and published to the
 * viewer store without dragging live three.js objects into React state.
 */

export interface InspectedMaterial {
  /** glTF material name, or `null` when the asset does not name it. */
  name: string | null;
  /** three.js material class, e.g. MeshStandardMaterial. */
  type: string;
  /** Base colour as `#rrggbb` when the material exposes one. */
  color: string | null;
  roughness: number | null;
  metalness: number | null;
  /** Distinct textures referenced by this material's slots. */
  textureCount: number;
  doubleSided: boolean;
}

export interface SceneInspection {
  meshCount: number;
  skinnedMeshCount: number;
  /** Distinct material instances across every mesh. */
  materialCount: number;
  /** Sum of triangle indices/positions, or `null` when no mesh has geometry. */
  triangleCount: number | null;
  /** Bounding-box extents in model units, or `null` for an empty scene. */
  dimensions: [number, number, number] | null;
  /** Longest axis first - useful when the panel only has room for one line. */
  largestAxis: 'x' | 'y' | 'z' | null;
  /** Names of named scene nodes (objects and meshes), capped for sanity. */
  objectNames: string[];
  /** How many named nodes existed before the cap was applied. */
  namedObjectCount: number;
  materials: InspectedMaterial[];
  animationNames: string[];
  hasMorphTargets: boolean;
  /** Distinct textures across every material in the scene. */
  textureCount: number;
}

/** Cap on names forwarded to the panel; glTF files can carry thousands. */
export const MAX_INSPECTED_NAMES = 24;

const TRIANGLES_PER_INDEX = 3;

function materialList(material: Mesh['material']): Material[] {
  if (Array.isArray(material)) return material.filter(Boolean) as Material[];
  return material ? [material] : [];
}

function toHex(color: unknown): string | null {
  // Only `Color` instances carry an inspectable hex value; textures and
  // other material slots are skipped instead of being stringified.
  const candidate = color as { isColor?: boolean; getHexString?: () => string } | undefined;
  if (!candidate || candidate.isColor !== true || typeof candidate.getHexString !== 'function') {
    return null;
  }
  return `#${candidate.getHexString()}`;
}

function countTextures(material: Material): number {
  const record = material as unknown as Record<string, unknown>;
  const seen = new Set<unknown>();
  for (const value of Object.values(record)) {
    // `Texture` instances expose `isTexture`; skip everything else cheaply.
    if (value && typeof value === 'object' && (value as { isTexture?: boolean }).isTexture === true) {
      seen.add(value);
    }
  }
  return seen.size;
}

function trianglesOf(mesh: Mesh): number | null {
  const geometry = mesh.geometry as
    | { index?: { count?: number } | null; attributes?: { position?: { count?: number } } }
    | undefined;
  if (!geometry) return null;
  const indexed = geometry.index?.count;
  if (typeof indexed === 'number' && indexed > 0) {
    return Math.floor(indexed / TRIANGLES_PER_INDEX);
  }
  const positions = geometry.attributes?.position?.count;
  if (typeof positions === 'number' && positions > 0) {
    return Math.floor(positions / TRIANGLES_PER_INDEX);
  }
  return null;
}

/**
 * Bounding-box extents, or null when three cannot compute them.
 *
 * `Box3.setFromObject` walks geometry buffers; a skinned mesh without a bound
 * skeleton throws. A missing measurement must never take the viewport down.
 */
function measureDimensions(root: Object3D): [number, number, number] | null {
  try {
    const box = new Box3().setFromObject(root);
    if (box.isEmpty()) return null;
    const size = box.getSize(new Vector3());
    return [round(size.x), round(size.y), round(size.z)];
  } catch {
    return null;
  }
}

/**
 * Describes a loaded scene.
 *
 * Never throws: a null root, an empty scene, or a mesh with missing geometry
 * yields zeroed counts with `null` for anything unknowable, so a malformed
 * asset can never stop the viewport from rendering.
 */
export function describeScene(
  root: Object3D | null | undefined,
  animations: readonly AnimationClip[] = [],
): SceneInspection | null {
  if (!root) return null;

  const materials = new Map<Material, InspectedMaterial>();
  const objectNames: string[] = [];
  let namedObjectCount = 0;
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let hasMorphTargets = false;
  let triangleTotal = 0;
  let sawTriangles = false;

  root.traverse((child) => {
    // Traversal can hand back anything for a malformed asset; skip whatever is
    // not an object rather than trusting the graph.
    if (!child || typeof child !== 'object') return;

    const rawName = (child as Object3D).name;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (name) {
      namedObjectCount += 1;
      if (objectNames.length < MAX_INSPECTED_NAMES) objectNames.push(name);
    }

    const candidate = child as Mesh;
    if (candidate.isMesh !== true) return;

    meshCount += 1;
    if ((candidate as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh === true) {
      skinnedMeshCount += 1;
    }
    const geometry = candidate.geometry as { morphAttributes?: Record<string, unknown[]> } | undefined;
    if (geometry?.morphAttributes) {
      for (const targets of Object.values(geometry.morphAttributes)) {
        if (Array.isArray(targets) && targets.length > 0) {
          hasMorphTargets = true;
          break;
        }
      }
    }

    const triangles = trianglesOf(candidate);
    if (triangles !== null) {
      sawTriangles = true;
      triangleTotal += triangles;
    }

    for (const material of materialList(candidate.material)) {
      if (materials.has(material)) continue;
      const record = material as unknown as Record<string, unknown>;
      materials.set(material, {
        name:
          typeof material.name === 'string' && material.name.trim().length > 0
            ? material.name.trim()
            : null,
        type: material.type ?? 'Material',
        color: toHex(record.color),
        roughness: typeof record.roughness === 'number' ? record.roughness : null,
        metalness: typeof record.metalness === 'number' ? record.metalness : null,
        textureCount: countTextures(material),
        doubleSided: record.side === 2,
      });
    }
  });

  const materialListOut = [...materials.values()];

  // Geometry-dependent values stay null when the scene holds no meshes, but
  // names and materials (if any) are still reported.
  const dims = meshCount === 0 ? null : measureDimensions(root);

  return {
    meshCount,
    skinnedMeshCount,
    materialCount: materialListOut.length,
    triangleCount: sawTriangles ? triangleTotal : null,
    dimensions: dims,
    largestAxis:
      dims === null
        ? null
        : dims[0] >= dims[1] && dims[0] >= dims[2]
          ? 'x'
          : dims[1] >= dims[2]
            ? 'y'
            : 'z',
    objectNames,
    namedObjectCount,
    materials: materialListOut,
    animationNames: animationNames(animations),
    hasMorphTargets,
    textureCount: materialListOut.reduce((sum, entry) => sum + entry.textureCount, 0),
  };
}

function animationNames(clips: readonly AnimationClip[]): string[] {
  return clips.map((clip, index) => clip.name?.trim() || `Clip ${index + 1}`);
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}