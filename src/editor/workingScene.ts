import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  Texture,
} from 'three';
import { ObjectRegistry, createIdPrefix } from './objectRegistry';
import { captureMaterialSnapshot, type MaterialSnapshot } from './materials';

/**
 * Working-scene ownership.
 *
 * ============================================================== OWNERSHIP ====
 * The GLTFLoader/useGLTF cache is the SOURCE. It is shared by every consumer
 * of a given URL for the whole session, so it is treated as strictly
 * immutable: the editor never mutates it and never disposes it.
 *
 * `createWorkingScene` builds an independently owned WORKING scene:
 *
 *   object hierarchy  -> cloned via SkeletonUtils.clone, so every node is a
 *                        distinct Object3D and skinned meshes are rebound to
 *                        cloned bones. Safe to transform, reparent and pose.
 *   materials         -> cloned ONCE per distinct source material into
 *                        `ownedMaterials`. Two meshes that shared a source
 *                        material still share one working material, so
 *                        intra-scene sharing semantics survive.
 *   geometries        -> SHARED READ-ONLY with the source. Editing geometry
 *                        later must first call `takeOwnershipOfGeometry`,
 *                        which clones it into `ownedGeometries`.
 *   textures          -> always shared and never owned. Textures are only
 *                        ever read.
 *
 * Disposal is the exact inverse: only `ownedMaterials`, `ownedGeometries` and
 * `ownedTextures` are disposed. Source materials, geometries and textures are
 * untouched, so a second viewer, the gallery thumbnail renderer and the
 * database record for this asset cannot be affected by editing.
 *
 * Stage 9D adds copy-on-write for MATERIALS, mirroring the geometry rules:
 *
 *   materials         -> cloned once per distinct source (as above), so sharing
 *                        is preserved by default
 *   copy-on-write     -> `takeOwnershipOfMaterial` clones a shared material for
 *                        ONE mesh slot and assigns the clone, leaving every
 *                        other user's material instance untouched
 *   textures          -> imported textures stay shared and read-only.
 *                        `claimTexture` takes ownership of a texture the editor
 *                        loaded itself (a replaced map), and
 *                        `releaseTextureIfUnused` disposes it only once no live
 *                        material slot still references it.
 *
 * "Unused" is always evaluated against the LIVE scene graph, never against the
 * ownership set alone: a texture can be editor-owned and still referenced by a
 * material that two objects share.
 *
 * This layer also fixes a confirmed Stage 8 defect: `SkeletonUtils.clone`
 * shares materials with the cache, so the old wireframe toggle mutated the
 * cached source material. Wireframe now only ever touches owned materials.
 * ===========================================================================
 */

export interface WorkingSceneOptions {
  /** Test seam; production scenes get a collision-proof generated prefix. */
  idPrefix?: string;
}

/**
 * Per-texture ownership record.
 *
 * Object URLs are deliberately NOT tracked: the loader revokes each one as soon
 * as the image has decoded, because the texture holds decoded pixels rather than
 * a URL. A texture can therefore be re-decoded after a WebGL context loss
 * without needing its source URL to still exist.
 */
export interface OwnedTextureRecord {
  texture: Texture;
  /** True when the editor loaded this from a user file, not from the GLTF. */
  fromFile: boolean;
}

export interface WorkingScene {
  /** Namespace for this scene's object ids. */
  readonly idPrefix: string;
  /** Independently owned root. Never the cached source object. */
  readonly root: Group;
  readonly registry: ObjectRegistry;
  /** Materials this scene owns and may dispose. */
  readonly ownedMaterials: ReadonlySet<Material>;
  /** Geometries this scene owns and may dispose. */
  readonly ownedGeometries: ReadonlySet<BufferGeometry>;
  /**
   * Textures this scene owns and may dispose - i.e. ones the editor loaded from
   * a user file. Imported GLTF textures are NEVER added here.
   */
  readonly ownedTextures: ReadonlySet<Texture>;
  /**
   * Per-texture bookkeeping for editor-owned textures (object URL, load
   * provenance), keyed by identity.
   */
  readonly textureRecords: ReadonlyMap<Texture, OwnedTextureRecord>;
/**
   * Baseline property values per material, captured when the material enters
   * editor ownership. Powers Reset, which restores the values the asset shipped
   * with rather than an arbitrary later state.
   */
  readonly materialSnapshots: ReadonlyMap<Material, MaterialSnapshot>;
  /**
   * Materials the EDITOR created (primitives, "New Material", duplicates) as
   * distinct from materials cloned from the GLTF source.
   *
   * Tracked separately because a newly created material is not yet on any mesh:
   * without this registry it would be unreachable by name, invisible to the
   * uniqueness check, and two clicks of "New Material" would both be called
   * `Material` with no way to tell them apart in a future assignment picker.
   */
  readonly editorMaterials: ReadonlySet<Material>;
  /** Assigns a unique name to an editor-created material. */
  nameEditorMaterial: (material: Material, base: string) => string;
  /**
   * Stable string id for a material, minted on first request.
   *
   * Undo/redo and project save/load must refer to a material WITHOUT holding a
   * live `Material` reference: React and persisted documents both need plain
   * serialisable data. This side table is the identity bridge - the scene
   * assigns ids, and a later `materialOf` call resolves them back to the live
   * instance. Ids are scene-scoped, so an id from a previous model cannot
   * resolve here.
   */
  materialId: (material: Material | null | undefined) => string | null;
  /** Resolves a material id minted by `materialId`. */
  materialOf: (id: string | null | undefined) => Material | null;
  /** Stable string id for an editor-owned texture, minted on first request. */
  textureId: (texture: Texture | null | undefined) => string | null;
  /** Resolves a texture id minted by `textureId`. */
  textureOf: (id: string | null | undefined) => Texture | null;
  /** source material -> working material, for copy-on-write in Stage 9D. */
  readonly materialMap: ReadonlyMap<Material, Material>;
  resolve: (id: string | null | undefined) => Object3D | null;
  /**
   * Copy-on-write for geometry. Clones the mesh's geometry into an owned
   * geometry and assigns it, so the shared source geometry is never mutated.
   * Safe to call repeatedly; a mesh keeps its own geometry afterwards.
   */
  takeOwnershipOfGeometry: (mesh: Mesh) => BufferGeometry;
  /**
   * Copy-on-write for a material slot.
   *
   * When the material at `slot` is used ONLY by this mesh, it is already
   * exclusively owned and is returned unchanged. When other objects share it, a
   * clone is created, claimed by this scene, and assigned to this one slot -
   * every other user keeps the original, so editing this object can never
   * silently restyle the rest of the model. Texture references are shared by the
   * clone, not duplicated.
   *
   * Returns the material the caller should mutate.
   */
  takeOwnershipOfMaterial: (mesh: Mesh, slot: number) => Material | null;
  /**
   * True when `material` is referenced by any live mesh slot other than the one
   * excluded. Drives the "shared by N objects" readout and the decision to
   * offer a shared-edit action.
   */
  countMaterialUsers: (material: Material, except?: { mesh: Mesh; slot: number }) => number;
  /** Ids of every object currently using `material`. */
  materialUserIds: (material: Material) => string[];
  /**
   * Takes ownership of a texture the editor itself loaded from a user file.
   *
   * Imported GLTF textures must never be passed here: they belong to the shared
   * loader cache and outlive this scene.
   */
  claimTexture: <T extends Texture>(texture: T) => T;
  /** Bookkeeping for one editor-owned texture, or undefined when unowned. */
  textureRecord: (texture: Texture | null | undefined) => OwnedTextureRecord | undefined;
  /** True when this scene owns (and may dispose) the texture. */
  ownsTexture: (texture: Texture | null | undefined) => boolean;
  /**
   * Disposes an editor-owned texture ONLY when no live material still reads it
   * from any of the supported slots. Returns true when disposal happened.
   */
  releaseTextureIfUnused: (texture: Texture | null | undefined) => boolean;
  /** Baseline snapshot for a material, capturing it on first request. */
  snapshotOf: (material: Material) => MaterialSnapshot;
  /**
   * Takes ownership of a geometry the editor itself just built, so it will be
   * disposed with the scene. Used by primitive creation and regeneration.
   */
  claimGeometry: <T extends BufferGeometry>(geometry: T) => T;
  /**
   * Disposes an owned geometry ONLY when no mesh in the working scene still
   * references it. Shared (imported) geometry is never touched.
   *
   * Returns true when the geometry was actually disposed, so tests can assert
   * that replaced geometry is released exactly once.
   */
  releaseGeometryIfUnused: (geometry: BufferGeometry | null | undefined) => boolean;
  /** True when this scene owns (and may dispose) the geometry. */
  ownsGeometry: (geometry: BufferGeometry | null | undefined) => boolean;
  /**
   * Holds a detached subtree's resources alive for a bounded period.
   *
   * Undo of a delete re-attaches the SAME Object3D - a rigged or morphed GLTF
   * subtree cannot be rebuilt from serialised data, so the nodes themselves are
   * parked off-graph. That means their owned geometry, materials and textures
   * must NOT be disposed while the undo entry is still live, otherwise undo would
   * resurrect an object whose GPU resources are gone.
   *
   * Retention is reference-counted per resource, so two history entries retaining
   * the same material release it only once both have dropped it.
   */
  retainDetached: (object: Object3D) => void;
  /**
   * Releases a retention taken by `retainDetached` and disposes whatever became
   * genuinely unused as a result. Safe to call for an object that was never
   * retained.
   */
  releaseDetached: (object: Object3D) => void;
  /**
   * Retains a single texture on behalf of a live undo entry.
   *
   * Undoing a texture replacement would otherwise free the texture that REDO
   * still needs. Retention is reference-counted, matching `retainDetached`.
   */
  retainTexture: (texture: Texture) => void;
  /** Drops one texture retention, disposing it if it became unused. */
  releaseRetainedTexture: (texture: Texture) => void;
  /**
   * Re-adopts an object - and every descendant - under the ids captured when it
   * was deleted, so undoing a delete restores the SAME identity rather than
   * minting new ids that nothing else (selection, history, panels) knows about.
   */
  adoptObject: (object: Object3D, id: string) => string;
  /** Registers a newly created object and returns its stable editor id. */
  registerObject: (object: Object3D) => string;
  /** Takes ownership of a material the editor itself created. */
  claimMaterial: <T extends Material>(material: T) => T;
  /**
   * Disposes an owned material ONLY when no live mesh slot references it.
   *
   * This is what makes copy-on-write safe: the material a clone was split away
   * from may become unreferenced, and disposing it then is correct - but only
   * because liveness is checked against the scene graph first, so a material
   * two objects still share is never destroyed under them.
   */
  releaseMaterialIfUnused: (material: Material | null | undefined) => boolean;
  /** Drops one registration so the id stops resolving. */
  unregisterObject: (id: string) => void;
  /** True once `dispose` has run. */
  readonly disposed: boolean;
  dispose: () => void;
}

function isMesh(value: Object3D): value is Mesh {
  return (value as Mesh).isMesh === true;
}

/** Texture slot keys checked when deciding whether a texture is still in use. */
const TEXTURE_SLOT_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
] as const;

/** Material slots of one mesh, as a flat list. */
function materialSlotsOf(mesh: Mesh): Material[] {
  const material = mesh.material as Material | Material[] | undefined;
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

/**
 * Resources held alive for a parked (detached) subtree.
 *
 * Reference-counted so overlapping retentions release exactly once, which keeps
 * "dispose replaced resources exactly once" true even when two undo entries
 * reference the same shared material.
 */
function createRetainers() {
  const geometries = new Map<BufferGeometry, number>();
  const materials = new Map<Material, number>();
  const textures = new Map<Texture, number>();

  const bump = <T>(table: Map<T, number>, key: T): void => {
    table.set(key, (table.get(key) ?? 0) + 1);
  };
  const unbump = <T>(table: Map<T, number>, key: T): void => {
    const next = (table.get(key) ?? 0) - 1;
    if (next > 0) table.set(key, next);
    else table.delete(key);
  };

  /** Walks a subtree, bumping every resource it can reach. */
  const walk = (
    object: Object3D,
    onMesh: (mesh: Mesh) => void,
  ): void => {
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      onMesh(mesh);
    });
  };

  return {
    geometries,
    materials,
    textures,

    collect(object: Object3D): void {
      walk(object, (mesh) => {
        if (mesh.geometry) bump(geometries, mesh.geometry);
        for (const material of materialSlotsOf(mesh)) {
          bump(materials, material);
          for (const key of TEXTURE_SLOT_KEYS) {
            const texture = (material as unknown as Record<string, Texture | undefined>)[key];
            if (texture) bump(textures, texture);
          }
        }
      });
    },

    /** Drops one retention and returns the resources it was the last holder of. */
    drop(object: Object3D): {
      geometries: BufferGeometry[];
      materials: Material[];
      textures: Texture[];
    } {
      const freed = {
        geometries: [] as BufferGeometry[],
        materials: [] as Material[],
        textures: [] as Texture[],
      };
      walk(object, (mesh) => {
        if (mesh.geometry) {
          unbump(geometries, mesh.geometry);
          if (!geometries.has(mesh.geometry)) freed.geometries.push(mesh.geometry);
        }
        for (const material of materialSlotsOf(mesh)) {
          unbump(materials, material);
          if (!materials.has(material)) freed.materials.push(material);
          for (const key of TEXTURE_SLOT_KEYS) {
            const texture = (material as unknown as Record<string, Texture | undefined>)[key];
            if (!texture) continue;
            unbump(textures, texture);
            if (!textures.has(texture)) freed.textures.push(texture);
          }
        }
      });
      return freed;
    },

    clear(): void {
      geometries.clear();
      materials.clear();
      textures.clear();
    },

    /** Reference-counted retention of one texture. */
    retain(texture: Texture): void {
      textures.set(texture, (textures.get(texture) ?? 0) + 1);
    },
    /** Returns true when this was the last retention of `texture`. */
    release(texture: Texture): boolean {
      const next = (textures.get(texture) ?? 0) - 1;
      if (next > 0) {
        textures.set(texture, next);
        return false;
      }
      textures.delete(texture);
      return true;
    },
  };
}

/**
 * Clones one material into the working scene, once per distinct source.
 * `Material.clone()` copies scalar/uniform state and shares texture
 * references, which is exactly what we want: textures stay shared and read-only.
 */
function cloneOwnedMaterial(
  source: Material,
  materialMap: Map<Material, Material>,
  ownedMaterials: Set<Material>,
  snapshots: Map<Material, MaterialSnapshot>,
): Material {
  const existing = materialMap.get(source);
  if (existing) return existing;

  const clone = source.clone();
  materialMap.set(source, clone);
  ownedMaterials.add(clone);
  // Captured while the clone still equals the source's values, so Reset returns
  // to what the asset shipped with.
  snapshots.set(clone, captureMaterialSnapshot(clone));
  return clone;
}

export function createWorkingScene(
  sourceRoot: Object3D,
  options: WorkingSceneOptions = {},
): WorkingScene {
  const idPrefix = options.idPrefix ?? createIdPrefix();
  const registry = new ObjectRegistry(idPrefix);

  // Node tree only: geometry, materials and textures are still shared here.
  const root = cloneSkeleton(sourceRoot) as Group;
  root.name = sourceRoot.name || 'Working Scene';

  const materialMap = new Map<Material, Material>();
  const ownedMaterials = new Set<Material>();
  const ownedGeometries = new Set<BufferGeometry>();
  const ownedTextures = new Set<Texture>();
  const textureRecords = new Map<Texture, OwnedTextureRecord>();
  const materialSnapshots = new Map<Material, MaterialSnapshot>();
  const editorMaterials = new Set<Material>();
  const retainers = createRetainers();

  root.traverse((object) => {
    if (!isMesh(object)) return;
    const source = object.material;
    if (!source) return;

    object.material = Array.isArray(source)
      ? source.map((entry) =>
          cloneOwnedMaterial(entry, materialMap, ownedMaterials, materialSnapshots),
        )
      : cloneOwnedMaterial(source, materialMap, ownedMaterials, materialSnapshots);
  });

  // Every node gets a stable id, including groups, bones and unnamed objects.
  root.traverse((object) => {
    registry.register(object);
  });
  registry.register(root);

  let disposed = false;

  const takeOwnershipOfGeometry = (mesh: Mesh): BufferGeometry => {
    const current = mesh.geometry;
    if (ownedGeometries.has(current)) return current;

    const owned = current.clone();
    ownedGeometries.add(owned);
    mesh.geometry = owned;
    return owned;
  };

  const ownsGeometry = (geometry: BufferGeometry | null | undefined): boolean =>
    !!geometry && ownedGeometries.has(geometry);

  /**
   * Disposes an owned geometry only when nothing still points at it.
   *
   * Two meshes can legitimately share one geometry (a duplicate of an imported
   * mesh keeps sharing the immutable source geometry; a duplicated primitive
   * may be given its own copy). Disposing here would then corrupt a surviving
   * object, so liveness is checked against the live scene graph first.
   */
  const releaseGeometryIfUnused = (geometry: BufferGeometry | null | undefined): boolean => {
    if (!geometry || !ownedGeometries.has(geometry)) return false;
    if (retainers.geometries.has(geometry)) return false;

    let stillUsed = false;
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry === geometry) stillUsed = true;
    });
    if (stillUsed) return false;

    ownedGeometries.delete(geometry);
    geometry.dispose();
    return true;
  };

  /* ----------------------------- materials ------------------------------- */

  /**
   * Counts live users of a material.
   *
   * `except` excludes one slot - the one about to be edited or reassigned -
   * so "is anybody else using this?" is answered about the OTHER objects, which
   * is exactly the question copy-on-write turns on.
   */
  const countMaterialUsers = (
    material: Material,
    except?: { mesh: Mesh; slot: number },
  ): number => {
    let count = 0;
    root.traverse((object) => {
      if (!isMesh(object)) return;
      materialSlotsOf(object).forEach((entry, slot) => {
        if (entry !== material) return;
        if (except && except.mesh === object && except.slot === slot) return;
        count += 1;
      });
    });
    return count;
  };

  const materialUserIds = (material: Material): string[] => {
    const ids: string[] = [];
    root.traverse((object) => {
      if (!isMesh(object)) return;
      if (!materialSlotsOf(object).includes(material)) return;
      const id = registry.idOf(object);
      if (id) ids.push(id);
    });
    return ids;
  };

  const takeOwnershipOfMaterial = (mesh: Mesh, slot: number): Material | null => {
    const material = mesh.material as Material | Material[] | undefined;
    if (!material) return null;

    const target = Array.isArray(material) ? material[slot] : slot === 0 ? material : undefined;
    if (!target) return null;

    // Already exclusive to this slot: editing it in place cannot surprise anyone.
    if (countMaterialUsers(target, { mesh, slot }) === 0) {
      return target;
    }

    // Shared: clone for this slot only. `Material.clone()` copies scalar and
    // uniform state and keeps the SAME texture references, which is required -
    // duplicating textures would multiply GPU memory for no benefit and would
    // also make "dispose the replaced texture" unsafe.
    const owned = target.clone();
    ownedMaterials.add(owned);
    materialSnapshots.set(owned, captureMaterialSnapshot(owned));

    if (Array.isArray(material)) {
      material[slot] = owned;
    } else {
      mesh.material = owned;
    }

    // The original may now be unreferenced; release it only if liveness agrees.
    releaseMaterialIfUnused(target);
    return owned;
  };

  const releaseMaterialIfUnused = (material: Material | null | undefined): boolean => {
    if (!material || !ownedMaterials.has(material)) return false;
    if (retainers.materials.has(material)) return false;
    if (countMaterialUsers(material) > 0) return false;

    ownedMaterials.delete(material);
    materialSnapshots.delete(material);
    material.dispose();
    return true;
  };

  /* ----------------------------- textures -------------------------------- */

  const ownsTexture = (texture: Texture | null | undefined): boolean =>
    !!texture && ownedTextures.has(texture);

  /**
   * Disposes an editor-owned texture only when no live material reads it.
   *
   * The check walks every mesh's material slots rather than the material set: a
   * texture the editor loaded for one slot can legitimately be referenced by
   * another slot or another object, and disposing it would leave a black or
   * untextured surface behind with no way for the user to tell why.
   */
  const releaseTextureIfUnused = (texture: Texture | null | undefined): boolean => {
    if (!texture || !ownedTextures.has(texture)) return false;
    if (retainers.textures.has(texture)) return false;

    let stillUsed = false;
    root.traverse((object) => {
      if (!isMesh(object)) return;
      for (const material of materialSlotsOf(object)) {
        for (const key of TEXTURE_SLOT_KEYS) {
          if ((material as unknown as Record<string, unknown>)[key] === texture) {
            stillUsed = true;
            return;
          }
        }
      }
    });
    if (stillUsed) return false;

    ownedTextures.delete(texture);
    textureRecords.delete(texture);
    texture.dispose();
    return true;
  };

  /**
   * Assigns a name no other live material already uses.
   *
   * Candidates come from BOTH sources: materials currently on a mesh (including
   * source clones) and editor-created materials that are not attached to
   * anything yet. Checking only the scene graph would let a freshly created,
   * not-yet-assigned material reuse a name and make the two indistinguishable
   * in the assignment picker.
   */
  const nameEditorMaterial = (material: Material, base: string): string => {
    const taken = new Set<string>();
    const record = (candidate: Material) => {
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
      if (name) taken.add(name.toLowerCase());
    };

    root.traverse((object) => {
      if (!isMesh(object)) return;
      materialSlotsOf(object).forEach(record);
    });
    editorMaterials.forEach(record);

    if (!taken.has(base.toLowerCase())) {
      material.name = base;
      return base;
    }
    let index = 1;
    while (taken.has(`${base}.${String(index).padStart(3, '0')}`.toLowerCase())) index += 1;
    const unique = `${base}.${String(index).padStart(3, '0')}`;
    material.name = unique;
    return unique;
  };

  const snapshotOf = (material: Material): MaterialSnapshot => {
    const existing = materialSnapshots.get(material);
    if (existing) return existing;
    const captured = captureMaterialSnapshot(material);
    materialSnapshots.set(material, captured);
    return captured;
  };

  /* --------------------- serialisable resource identity -------------------- */

  /**
   * Ids for materials and textures, so history and saved projects can name a
   * resource without carrying a live three.js object across.
   *
   * These tables are deliberately NOT part of ownership: an id is an address, not
   * a claim. Releasing a material disposes it and drops it from `ownedMaterials`,
   * but the id stays mapped until scene disposal, so a stale reference resolves
   * to a miss rather than to somebody else's material.
   */
  const materialIds = new Map<Material, string>();
  const materialsById = new Map<string, Material>();
  const textureIds = new Map<Texture, string>();
  const texturesById = new Map<string, Texture>();

  const mintId = (prefix: string, taken: Set<string>): string => {
    let index = taken.size + 1;
    let id = `${prefix}-${index}`;
    while (taken.has(id)) {
      index += 1;
      id = `${prefix}-${index}`;
    }
    taken.add(id);
    return id;
  };

  const materialId = (material: Material | null | undefined): string | null => {
    if (!material) return null;
    const existing = materialIds.get(material);
    if (existing) return existing;

    const id = mintId('mat', new Set(materialsById.keys()));
    materialIds.set(material, id);
    materialsById.set(id, material);
    return id;
  };

  const materialOf = (id: string | null | undefined): Material | null => {
    if (!id) return null;
    return materialsById.get(id) ?? null;
  };

  const textureId = (texture: Texture | null | undefined): string | null => {
    if (!texture) return null;
    const existing = textureIds.get(texture);
    if (existing) return existing;

    const id = mintId('tex', new Set(texturesById.keys()));
    textureIds.set(texture, id);
    texturesById.set(id, texture);
    return id;
  };

  const textureOf = (id: string | null | undefined): Texture | null => {
    if (!id) return null;
    return texturesById.get(id) ?? null;
  };

  /**
   * Parks a detached subtree's resources so `release*IfUnused` cannot dispose
   * something an undo entry still needs. The object itself is owned by the
   * history module, not here.
   */
  const retainDetached = (object: Object3D): void => {
    retainers.collect(object);
  };

  /**
   * Releases one retention and disposes whatever it was the last holder of.
   *
   * Disposal is deliberately deferred to the normal liveness checks rather than
   * done here directly: a resource may still be referenced by a mesh that never
   * left the graph, in which case only the graph knows it must survive.
   */
  const releaseDetached = (object: Object3D): void => {
    const freed = retainers.drop(object);
    for (const texture of freed.textures) releaseTextureIfUnused(texture);
    for (const material of freed.materials) releaseMaterialIfUnused(material);
    for (const geometry of freed.geometries) releaseGeometryIfUnused(geometry);
  };

  const retainTexture = (texture: Texture): void => {
    retainers.retain(texture);
  };

  const releaseRetainedTexture = (texture: Texture): void => {
    if (retainers.release(texture)) releaseTextureIfUnused(texture);
  };

  return {
    idPrefix,
    root,
    registry,
    ownedMaterials,
    ownedGeometries,
ownedTextures,
      textureRecords,
      materialSnapshots,
    materialMap,
    resolve: (id) => registry.resolve(id),
    takeOwnershipOfGeometry,
    takeOwnershipOfMaterial,
    countMaterialUsers,
    materialUserIds,
    claimTexture: <T extends Texture>(texture: T) => {
      ownedTextures.add(texture);
      textureRecords.set(texture, { texture, fromFile: true });
      return texture;
    },
    textureRecord: (texture) => (texture ? textureRecords.get(texture) : undefined),
    ownsTexture,
    releaseTextureIfUnused,
    snapshotOf,
    claimGeometry: <T extends BufferGeometry>(geometry: T) => {
      ownedGeometries.add(geometry);
      return geometry;
    },
    ownsGeometry,
releaseGeometryIfUnused,
    registerObject: (object) => registry.register(object),
    adoptObject: (object, id) => registry.registerAs(object, id),
    retainDetached,
    releaseDetached,
    retainTexture,
    releaseRetainedTexture,
    claimMaterial: <T extends Material>(material: T) => {
      ownedMaterials.add(material);
      // Everything the editor claims is by definition editor-created: source
      // materials only ever arrive through `cloneOwnedMaterial`.
      editorMaterials.add(material);
      materialSnapshots.set(material, captureMaterialSnapshot(material));
      return material;
    },
    editorMaterials,
    nameEditorMaterial,
    materialId,
    materialOf,
    textureId,
    textureOf,
    releaseMaterialIfUnused,
    unregisterObject: (id: string) => {
      registry.unregister(id);
    },
    get disposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;

      // Textures are disposed FIRST. A material's GPU program references its
      // textures, so releasing textures while materials are still registered
      // would leave the renderer with a program pointing at freed uploads.
      for (const texture of ownedTextures) texture.dispose();
      ownedTextures.clear();
      textureRecords.clear();

      for (const material of ownedMaterials) material.dispose();
      ownedMaterials.clear();

      for (const geometry of ownedGeometries) geometry.dispose();
      ownedGeometries.clear();

      materialSnapshots.clear();
      editorMaterials.clear();
      materialMap.clear();
      materialIds.clear();
      materialsById.clear();
      textureIds.clear();
      texturesById.clear();
      retainers.clear();
      registry.clear();

      // Detach the working tree so it can no longer be picked up by a
      // raycast or a traversal, but do NOT dispose its nodes: Object3D has no
      // dispose, and its shared source geometry must survive.
      root.removeFromParent();
    },
  };
}