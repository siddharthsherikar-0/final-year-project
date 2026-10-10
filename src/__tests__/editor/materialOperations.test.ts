import { describe, it, expect, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  Texture,
} from 'three';
import type { Material } from 'three';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import {
  assignMaterialTexture,
  assignMaterialToSlot,
  clearMaterialTexture,
  createEditorMaterial,
  duplicateMaterial,
  editSharedMaterial,
  renameMaterial,
  resetMaterial,
  sceneMaterialNames,
  setMaterialColor,
  setMaterialEmissiveColor,
  setMaterialEmissiveIntensity,
  setMaterialOpacity,
  setMaterialScalar,
  setMaterialTransparency,
} from '@/editor/materialOperations';
import { inspectMaterials } from '@/editor/materialInspection';

/**
 * Stage 9D material editing contract.
 *
 * Two guarantees are load-bearing and are asserted from BOTH directions:
 *
 *  1. Copy-on-write. Editing one object's material must not restyle the objects
 *     that share it. Tests check the edited object changed AND the others did
 *     not, because asserting only the first would pass even if the second broke.
 *
 *  2. Source immutability. The material cloned into the working scene is a
 *     different instance from the cached one, so every edit must leave the
 *     source exactly as the GLTF loader produced it.
 */

/**
 * First mesh in the working scene.
 *
 * NOT `registry.ids()[0]`: the registry also contains the scene ROOT, which is
 * registered last but is not a mesh, so indexing blindly resolves the root and
 * every material assertion then fails against a Group.
 */
function firstMesh(working: WorkingScene): Mesh {
  let found: Mesh | null = null;
  working.root.traverse((object) => {
    if (found) return;
    const mesh = object as Mesh;
    if (mesh.isMesh === true) found = mesh;
  });
  if (!found) throw new Error('No mesh in the working scene');
  return found;
}

/**
 * Records whether `needsUpdate` was ever set on a material.
 *
 * `Material.needsUpdate` is a write-only accessor in three (it only bumps
 * `version`), so reading it returns undefined and cannot be asserted directly.
 * This spies on the property instead.
 */
function trackNeedsUpdate(material: Material): () => boolean {
  let triggered = false;
  let current: unknown;
  Object.defineProperty(material, 'needsUpdate', {
    configurable: true,
    get: () => current,
    set: (value: unknown) => {
      current = value;
      if (value) triggered = true;
    },
  });
  return () => triggered;
}

/** Mesh registered under a given name. */
function meshNamed(working: WorkingScene, name: string): Mesh {
  const found = working.resolve(
    working.registry.ids().find((id) => working.resolve(id)?.name === name),
  ) as Mesh | null;
  if (!found || found.isMesh !== true) throw new Error(`No mesh named ${name}`);
  return found;
}

/** `#rrggbb` for a colour slot, read back in sRGB. */
function hexOf(material: Material | undefined, key = 'color'): string {
  const colour = (material as unknown as Record<string, { getHexString: (s?: string) => string }> | undefined)?.[
    key
  ];
  if (!colour) throw new Error(`No ${key} on this material`);
  return `#${colour.getHexString('srgb')}`;
}

function numberOf(material: Material | undefined, key: string): number {
  return (material as unknown as Record<string, unknown> | undefined)?.[key] as number;
}

/** Two meshes sharing one source material, inside a fresh working scene. */
function sharedScene(): {
  working: WorkingScene;
  source: MeshStandardMaterial;
  a: Mesh;
  b: Mesh;
  workingA: Mesh;
  workingB: Mesh;
} {
  const source = new MeshStandardMaterial({ color: 0x808080, roughness: 0.5, metalness: 0.2 });
  source.name = 'SharedSource';

  const a = new Mesh(new BoxGeometry(1, 1, 1), source);
  a.name = 'A';
  const b = new Mesh(new BoxGeometry(1, 1, 1), source);
  b.name = 'B';

  const scene = new Scene();
  scene.add(a, b);

  const working = createWorkingScene(scene, { idPrefix: 't' });

  return { working, source, a, b, workingA: meshNamed(working, 'A'), workingB: meshNamed(working, 'B') };
}

describe('material copy-on-write', () => {
  it('clones a shared material for one slot and leaves the other user untouched', () => {
    const { working, workingA, workingB } = sharedScene();

    const beforeA = hexOf(workingA.material as Material);
    const beforeB = hexOf(workingB.material as Material);
    expect(beforeA).toBe(beforeB);

    const result = setMaterialColor(working, workingA, 0, '#ff0000');
    expect(result.ok).toBe(true);
    expect(result.copied).toBe(true);

    // The edited object changed...
    expect(hexOf(workingA.material as Material)).toBe('#ff0000');
    // ...and its neighbour did not.
    expect(hexOf(workingB.material as Material)).toBe(beforeB);
  });

  it('edits in place when the material is already exclusive to the slot', () => {
    const source = new MeshStandardMaterial();
    const mesh = new Mesh(new SphereGeometry(1, 8, 8), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    const material = workingMesh.material as Material;
    const result = setMaterialColor(working, workingMesh, 0, '#00ff00');

    expect(result.ok).toBe(true);
    expect(result.copied).toBe(false);
    // No clone was needed, so the instance is unchanged - which is what makes
    // repeated single-user edits allocation-free.
    expect(workingMesh.material).toBe(material);
  });

  it('never mutates the cached source material', () => {
    const { working, source, workingA } = sharedScene();
    const sourceColor = source.color.getHex();

    setMaterialColor(working, workingA, 0, '#123456');
    setMaterialScalar(working, workingA, 0, 'roughness', 0.11);
    setMaterialScalar(working, workingA, 0, 'metalness', 0.99);
    setMaterialOpacity(working, workingA, 0, 0.3);
    setMaterialEmissiveColor(working, workingA, 0, '#00ffff');
    setMaterialEmissiveIntensity(working, workingA, 0, 3);

    expect(source.color.getHex()).toBe(sourceColor);
    expect(source.roughness).toBe(0.5);
    expect(source.metalness).toBe(0.2);
    expect(source.opacity).toBe(1);
    expect(source.transparent).toBe(false);
  });

  it('keeps two slots on ONE multi-material mesh independent', () => {
    const shared = new MeshStandardMaterial({ color: 0xffffff });
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, [shared, shared]);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    setMaterialColor(working, workingMesh, 0, '#ff00ff');

    const slots = workingMesh.material as Material[];
    expect(slots).toHaveLength(2);
    expect(hexOf(slots[0])).toBe('#ff00ff');
    expect(hexOf(slots[1])).toBe('#ffffff');
    expect(slots[0]).not.toBe(slots[1]);
  });

  it('edits a shared material in place when the shared mode is requested', () => {
    const { working, workingA, workingB } = sharedScene();
    const beforeB = hexOf(workingB.material as Material);

    // Explicit opt-in: this is the one path that deliberately restyles every
    // user, so it must not go through copy-on-write.
    const result = setMaterialColor(working, workingA, 0, '#ff0000', 'shared');
    expect(result.ok).toBe(true);
    expect(result.copied).toBe(false);
    expect(workingA.material).toBe(workingB.material);
    expect(hexOf(workingB.material as Material)).toBe('#ff0000');
    expect(hexOf(workingB.material as Material)).not.toBe(beforeB);
  });

  it('preserves sharing semantics for identical source materials on different meshes', () => {
    const { working, workingA, workingB } = sharedScene();
    // Reading, not writing: two meshes cloned from one source must still share.
    expect(workingA.material).toBe(workingB.material);
    expect(working.countMaterialUsers(workingA.material as Material)).toBe(2);
  });

  it('disposes the split-away original only when nothing else uses it', () => {
    const source = new MeshStandardMaterial();
    const a = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(a);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const material = workingMesh.material as Material;

    // Force a clone even though the material is exclusive, by sharing it with a
    // second mesh that is then removed.
    const b = new Mesh(new BoxGeometry(1, 1, 1), material);
    working.root.add(b);
    const bId = working.registerObject(b);

    const clone = working.takeOwnershipOfMaterial(workingMesh, 0);
    expect(clone).not.toBe(material);
    expect(working.ownedMaterials.has(material)).toBe(true);

    // Still shared with B, so the original must survive.
    expect(working.releaseMaterialIfUnused(material)).toBe(false);

    working.resolve(bId)?.removeFromParent();
    expect(working.releaseMaterialIfUnused(material)).toBe(true);
  });

  it('reports the number of other slots sharing a material', () => {
    const { working, workingA, workingB } = sharedScene();
    const material = workingA.material as Material;
    expect(working.countMaterialUsers(material)).toBe(2);
    expect(working.countMaterialUsers(material, { mesh: workingA, slot: 0 })).toBe(1);
    expect(working.materialUserIds(material)).toHaveLength(2);
    expect(workingB.material).toBe(material);
  });

  it('refuses a shared edit when the material has a single user', () => {
    const { working, workingA } = sharedScene();
    // Clone for A first, so A's material is now exclusive to A.
    setMaterialColor(working, workingA, 0, '#ff0000');
    const result = editSharedMaterial(working, workingA, 0);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not shared/i);
  });

  it('allows a shared edit when the material really is shared', () => {
    const { working, workingA } = sharedScene();
    const result = editSharedMaterial(working, workingA, 0);
    expect(result.ok).toBe(true);
    expect(result.material).toBe(workingA.material);
  });
});

describe('material property editing', () => {
  it('writes base colour and normalises hex', () => {
    const { working, workingA } = sharedScene();
    expect(setMaterialColor(working, workingA, 0, 'ABC').ok).toBe(true);
    expect(hexOf(workingA.material as Material)).toBe('#aabbcc');
  });

  it('rejects malformed hex without touching the material', () => {
    const { working, workingA } = sharedScene();
    const before = hexOf(workingA.material as Material);
    const result = setMaterialColor(working, workingA, 0, 'not-a-colour');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/hex/i);
    expect(hexOf(workingA.material as Material)).toBe(before);
  });

  it('writes roughness and metalness within 0..1', () => {
    const { working, workingA } = sharedScene();
    setMaterialScalar(working, workingA, 0, 'roughness', 0.25);
    setMaterialScalar(working, workingA, 0, 'metalness', 0.75);
    expect(numberOf(workingA.material as Material, 'roughness')).toBe(0.25);
    expect(numberOf(workingA.material as Material, 'metalness')).toBe(0.75);
  });

  it('clamps out-of-range scalars instead of writing them', () => {
    const { working, workingA } = sharedScene();
    const result = setMaterialScalar(working, workingA, 0, 'roughness', 5);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
  });

  it('rejects non-finite scalars', () => {
    const { working, workingA } = sharedScene();
    expect(setMaterialScalar(working, workingA, 0, 'roughness', Number.NaN).ok).toBe(false);
    expect(setMaterialScalar(working, workingA, 0, 'metalness', Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it('turns transparency on automatically when opacity drops below 1', () => {
    const { working, workingA } = sharedScene();

    const result = setMaterialOpacity(working, workingA, 0, 0.4);
    // Re-read AFTER the write: copy-on-write replaced the instance.
    const material = workingA.material as MeshStandardMaterial;
    expect(result.copied).toBe(true);

    // Opacity alone is invisible in three.js: `transparent` must follow.
    expect(material.opacity).toBeCloseTo(0.4, 5);
    expect(material.transparent).toBe(true);
    // Depth writing while blending causes z-fighting, so it is turned off.
    expect(material.depthWrite).toBe(false);
  });

  it('restores opacity and depth writing when opacity returns to 1', () => {
    const { working, workingA } = sharedScene();

    setMaterialOpacity(working, workingA, 0, 0.2);
    setMaterialOpacity(working, workingA, 0, 1);
    const material = workingA.material as MeshStandardMaterial;

    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it('makes the transparency toggle visible rather than a no-op', () => {
    const { working, workingA } = sharedScene();

    setMaterialTransparency(working, workingA, 0, true);
    const material = workingA.material as MeshStandardMaterial;

    // An opacity of exactly 1 while blending is pointless AND sorts the object
    // into the transparent queue, so it drops to a visually identical 0.99.
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
    expect(material.depthWrite).toBe(false);

    setMaterialTransparency(working, workingA, 0, false);
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
  });

  it('writes emissive colour and intensity', () => {
    const { working, workingA } = sharedScene();

    setMaterialEmissiveColor(working, workingA, 0, '#ff8800');
    setMaterialEmissiveIntensity(working, workingA, 0, 2.5);
    const material = workingA.material as Material;

    expect(hexOf(material, 'emissive')).toBe('#ff8800');
    expect(numberOf(material, 'emissiveIntensity')).toBe(2.5);
  });

  it('bounds emissive intensity', () => {
    const { working, workingA } = sharedScene();
    const result = setMaterialEmissiveIntensity(working, workingA, 0, 1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(10);
    expect(setMaterialEmissiveIntensity(working, workingA, 0, -3).value).toBe(0);
  });

  it('refuses PBR properties on a Basic material with a clear reason', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xff0000 }));
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    // Colour IS supported...
    expect(setMaterialColor(working, workingMesh, 0, '#00ff00').ok).toBe(true);
    // ...roughness is not, and the refusal says why.
    const roughness = setMaterialScalar(working, workingMesh, 0, 'roughness', 0.5);
    expect(roughness.ok).toBe(false);
    expect(roughness.error).toMatch(/MeshBasicMaterial does not support/);
    // Emissive does not exist on Basic either.
    expect(setMaterialEmissiveColor(working, workingMesh, 0, '#ffffff').ok).toBe(false);
  });

  it('allows emissive on a Lambert material but not roughness', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial());
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    expect(setMaterialEmissiveColor(working, workingMesh, 0, '#00ff00').ok).toBe(true);
    expect(setMaterialScalar(working, workingMesh, 0, 'roughness', 0.5).ok).toBe(false);
  });

  it('rejects an out-of-range slot index', () => {
    const { working, workingA } = sharedScene();
    expect(setMaterialColor(working, workingA, 4, '#ffffff').ok).toBe(false);
    expect(setMaterialColor(working, workingA, -1, '#ffffff').ok).toBe(false);
  });
});

describe('material assignment and duplication', () => {
  it('creates an editor-owned material with unique names', () => {
    const { working } = sharedScene();
    const first = createEditorMaterial(working, 'Paint');
    const second = createEditorMaterial(working, 'Paint');

    expect(first.name).toBe('Paint');
    expect(second.name).toBe('Paint.001');
    expect(working.ownedMaterials.has(first)).toBe(true);
    // Ownership must not extend to a mesh it was never assigned to.
    expect(workingMeshUses(working, first)).toBe(false);
  });

  it('assigns a new material to one slot only', () => {
    const { working, workingA } = sharedScene();
    const material = createEditorMaterial(working, 'Paint');

    const result = assignMaterialToSlot(working, workingA, 0, material);
    expect(result.ok).toBe(true);
    expect(workingA.material).toBe(material);
  });

  it('refuses to assign beyond the mesh slot count', () => {
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [material, material]);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const other = createEditorMaterial(working, 'Other');

    expect(assignMaterialToSlot(working, workingMesh, 2, other).ok).toBe(false);
    expect((workingMesh.material as Material[]).length).toBe(2);
  });

  it('does not collapse a multi-material mesh', () => {
    const materials = [
      new MeshStandardMaterial({ color: 0xff0000 }),
      new MeshStandardMaterial({ color: 0x00ff00 }),
      new MeshStandardMaterial({ color: 0x0000ff }),
    ];
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), materials);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const replacement = createEditorMaterial(working, 'Replacement');

    assignMaterialToSlot(working, workingMesh, 1, replacement);

    const slots = workingMesh.material as Material[];
    expect(Array.isArray(workingMesh.material)).toBe(true);
    expect(slots).toHaveLength(3);
    expect(slots[1]).toBe(replacement);
    // The untouched slots keep their identity.
    expect(slots[0]).not.toBe(replacement);
    expect(slots[2]).not.toBe(replacement);
  });

  it('duplicates a material so it can be edited independently', () => {
    const { working, workingA, workingB } = sharedScene();
    const shared = workingA.material as Material;

    const result = duplicateMaterial(working, workingA, 0);
    expect(result.ok).toBe(true);
    const copy = result.material!;
    expect(copy).not.toBe(shared);
    // The copy is now installed on A, and A is its only user, so the following
    // edit is in place - no further clone.
    expect(workingA.material).toBe(copy);

    setMaterialColor(working, workingA, 0, '#ff00ff');

    // The copy took the edit...
    expect(hexOf(copy)).toBe('#ff00ff');
    // ...and the neighbour's shared original is untouched.
    expect(workingB.material).toBe(shared);
    expect(hexOf(shared)).not.toBe('#ff00ff');
  });

  it('shares textures between a material and its duplicate', () => {
    const source = new MeshStandardMaterial();
    source.name = 'Textured';
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const original = workingMesh.material as Material;

    const result = duplicateMaterial(working, workingMesh, 0);
    expect((result.material as MeshStandardMaterial).map).toBe(
      (original as MeshStandardMaterial).map,
    );
  });

  it('renames a material with validation', () => {
    const { working, workingA } = sharedScene();
    const material = workingA.material as Material;
    material.name = 'Original';

    expect(renameMaterial(working, material, '  Renamed  ').ok).toBe(true);
    expect(material.name).toBe('Renamed');
    expect(renameMaterial(working, material, '   ').ok).toBe(false);
    expect(renameMaterial(working, material, 'x'.repeat(80)).ok).toBe(false);
  });

  it('lists each distinct material name once', () => {
    const { working, workingA } = sharedScene();
    const material = workingA.material as Material;
    material.name = 'Alpha';
    // A and B share one material INSTANCE, so the name must appear once - a
    // picker listing "Alpha" five times on a shared-material character model
    // would be unusable.
    expect(sceneMaterialNames(working)).toEqual(['Alpha']);

    const beta = createEditorMaterial(working, 'Beta');
    assignMaterialToSlot(working, workingA, 0, beta);
    expect(sceneMaterialNames(working).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('keeps a created material reachable by name before it is assigned', () => {
    const { working, workingA } = sharedScene();
    const material = workingA.material as Material;
    material.name = 'Paint';

    // Not assigned to anything yet, so it is off the scene graph - but it must
    // still be findable, or the next "New Material" would collide silently.
    const created = createEditorMaterial(working, 'Paint');
    expect(created.name).toBe('Paint.001');
    expect(working.editorMaterials.has(created)).toBe(true);
  });
});

describe('material reset', () => {
  it('restores captured baseline values', () => {
    const source = new MeshStandardMaterial({
      color: 0x336699,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const material = workingMesh.material as Material;

    setMaterialColor(working, workingMesh, 0, '#ff0000');
    setMaterialScalar(working, workingMesh, 0, 'roughness', 0.95);
    setMaterialScalar(working, workingMesh, 0, 'metalness', 0.95);

    expect(resetMaterial(working, workingMesh, 0).ok).toBe(true);

    expect(hexOf(material)).toBe('#336699');
    expect(numberOf(material, 'roughness')).toBeCloseTo(0.4, 5);
    expect(numberOf(material, 'metalness')).toBeCloseTo(0.1, 5);
  });

  it('marks the material for recompile after reset', () => {
    const source = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    // Exclusive material: no copy-on-write clone, so the tracer installed here
    // is the material that reset actually writes to.
    const material = workingMesh.material as Material;
    const needsUpdate = trackNeedsUpdate(material);

    resetMaterial(working, workingMesh, 0);

    // Changing blending state or texture slots requires a new shader program.
    expect(needsUpdate()).toBe(true);
  });

  it('restores transparency state', () => {
    const { working, workingA } = sharedScene();

    setMaterialOpacity(working, workingA, 0, 0.2);
    expect((workingA.material as MeshStandardMaterial).transparent).toBe(true);

    resetMaterial(working, workingA, 0);
    const material = workingA.material as MeshStandardMaterial;

    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
  });

  it('does not write PBR properties a Basic material lacks', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0x00ff00 }));
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    expect(resetMaterial(working, workingMesh, 0).ok).toBe(true);
    expect((workingMesh.material as MeshStandardMaterial).roughness).toBeUndefined();
  });
});

describe('material inspection view model', () => {
  it('reports values, sharing and ownership without leaking three objects', () => {
    const source = new MeshStandardMaterial({ color: 0xff8800, roughness: 0.2, metalness: 0.9 });
    const a = new Mesh(new BoxGeometry(1, 1, 1), source);
    const b = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(a, b);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const mesh = firstMesh(working);

    const inspection = inspectMaterials(working, mesh, 0);
    expect(inspection).not.toBeNull();
    expect(inspection?.multiMaterial).toBe(false);
    expect(inspection?.slots).toHaveLength(1);

    const slot = inspection?.slots[0];
    expect(slot?.color).toBe('#ff8800');
    expect(slot?.roughness).toBeCloseTo(0.2, 5);
    expect(slot?.metalness).toBeCloseTo(0.9, 5);
    expect(slot?.shared).toBe(true);
    expect(slot?.userCount).toBe(2);
    expect(slot?.editorOwned).toBe(true);
    expect(slot?.capabilities.family).toBe('PBR');
    expect(slot?.textures).toHaveLength(6);
    expect(slot?.textures.every((texture) => texture.populated === false)).toBe(true);
    // The view model is plain data only.
    expect(JSON.parse(JSON.stringify(slot)).userCount).toBe(2);
  });

  it('exposes every texture slot with its colour space', () => {
    const { working, workingA } = sharedScene();
    const slot = inspectMaterials(working, workingA, 0)!.slots[0];
    const spaces = Object.fromEntries((slot?.textures ?? []).map((entry) => [entry.key, entry.colorSpace]));
    expect(spaces).toEqual({
      map: 'srgb',
      normalMap: 'data',
      roughnessMap: 'data',
      metalnessMap: 'data',
      emissiveMap: 'srgb',
      aoMap: 'data',
    });
  });

  it('clamps an out-of-range requested slot', () => {
    const shared = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [shared, shared]);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    const inspection = inspectMaterials(working, workingMesh, 9);
    expect(inspection!.activeSlot).toBe(1);
    expect(inspection!.multiMaterial).toBe(true);
  });

  it('returns null for a non-mesh selection', () => {
    const { working, workingA } = sharedScene();
    const group = new Group();
    working.root.add(group);
    const groupId = working.registerObject(group);

    expect(inspectMaterials(working, working.resolve(groupId) as Mesh)).toBeNull();
    expect(inspectMaterials(null, workingA)).toBeNull();
  });

  it('describes an unsupported material class honestly', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);

    const slot = inspectMaterials(working, workingMesh, 0)?.slots[0];
    expect(slot?.capabilities.editable).toBe(true);
    expect(slot?.capabilities.roughness).toBe(false);
    expect(slot?.roughness).toBeNull();
    expect(slot?.emissive).toBeNull();
  });
});

describe('working scene texture ownership', () => {
  it('does not own imported textures', () => {
    const { working, workingA } = sharedScene();
    const material = workingA.material as MeshStandardMaterial;
    expect(working.ownsTexture(material.map)).toBe(false);
  });

  it('disposes an owned texture and revokes its object URL', () => {
    const source = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const material = workingMesh.material as MeshStandardMaterial;
    const texture = new Texture();
    working.claimTexture(texture);
    expect(working.ownsTexture(texture)).toBe(true);
    expect(working.textureRecord(texture)?.fromFile).toBe(true);

    const dispose = vi.spyOn(texture, 'dispose');
    assignMaterialTexture(working, workingMesh, 0, 'map', texture);
    expect(material.map).toBe(texture);

    // Clearing releases the texture because nothing references it any more.
    clearMaterialTexture(working, workingMesh, 0, 'map');
    expect(material.map).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(working.ownsTexture(texture)).toBe(false);
  });

  it('does not dispose a texture that another slot still reads', () => {
    const shared = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [shared, shared]);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
            const texture = new Texture();
    // Put it on both working slots by cloning per slot.
    assignMaterialTexture(working, workingMesh, 0, 'map', texture);
    const secondMaterial = working.takeOwnershipOfMaterial(workingMesh, 1)!;
    (secondMaterial as unknown as Record<string, unknown>).map = texture;
    working.claimTexture(texture);

    const dispose = vi.spyOn(texture, 'dispose');
    // Slot 0 no longer points at it, but slot 1 does.
    clearMaterialTexture(working, workingMesh, 0, 'map');
    expect(dispose).not.toHaveBeenCalled();
    expect(working.ownsTexture(texture)).toBe(true);
  });

  it('never disposes an imported texture, even when unreferenced', () => {
    const imported = new Texture();
    const source = new MeshStandardMaterial({ map: imported });
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), source);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const dispose = vi.spyOn(imported, 'dispose');

    clearMaterialTexture(working, workingMesh, 0, 'map');

    expect(dispose).not.toHaveBeenCalled();
    expect(working.releaseTextureIfUnused(imported)).toBe(false);
  });

  it('disposes editor-owned textures on scene teardown without touching the source', () => {
    const sourceTexture = new Texture();
    const sourceMaterial = new MeshStandardMaterial({ map: sourceTexture });
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), sourceMaterial);
    const scene = new Scene();
    scene.add(mesh);
    const working = createWorkingScene(scene, { idPrefix: 't' });
    const workingMesh = firstMesh(working);
    const editorTexture = new Texture();
    working.claimTexture(editorTexture);
    assignMaterialTexture(working, workingMesh, 0, 'aoMap', editorTexture);

    const editorDispose = vi.spyOn(editorTexture, 'dispose');
    const sourceDispose = vi.spyOn(sourceTexture, 'dispose');

    working.dispose();

    expect(editorDispose).toHaveBeenCalledTimes(1);
    // The cached texture belongs to the GLTF source and must survive.
    expect(sourceDispose).not.toHaveBeenCalled();
  });

  it('deleting an object does not destroy a material another object uses', () => {
    const source = new MeshStandardMaterial({ color: 0x00ff00 });
    const a = new Mesh(new BoxGeometry(1, 1, 1), source);
    a.name = 'A';
    const b = new Mesh(new BoxGeometry(1, 1, 1), source);
    b.name = 'B';
    const scene = new Scene();
    scene.add(a, b);
    const working = createWorkingScene(scene, { idPrefix: 't' });

    const workingA = meshNamed(working, 'A');
    const workingB = meshNamed(working, 'B');
    // `a` is the SOURCE mesh; the working scene holds clones, so the material
    // under test is the one installed on the working mesh.
    const shared = workingA.material as Material;
    const dispose = vi.spyOn(shared, 'dispose');

    workingA.removeFromParent();

    expect(working.releaseMaterialIfUnused(shared)).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    expect(workingB.material).toBe(shared);
  });
});

function workingMeshUses(working: WorkingScene, material: Material): boolean {
  let found = false;
  working.root.traverse((child) => {
    const candidate = child as Mesh;
    if (candidate.isMesh !== true) return;
    const list = candidate.material as Material | Material[];
    if (Array.isArray(list) ? list.includes(material) : list === material) found = true;
  });
  return found;
}