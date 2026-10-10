import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Scene,
  Vector3,
} from 'three';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import {
  canDelete,
  canDuplicate,
  canGroup,
  canUngroup,
  createPrimitive,
  deleteObjects,
  duplicateObject,
  groupObjects,
  regeneratePrimitive,
  renameObject,
  setObjectVisibility,
  uniqueName,
  ungroupObject,
} from '@/editor/objectOperations';
import { defaultParams, readPrimitiveMeta, type PrimitiveKind } from '@/editor/primitives';
import { buildSceneTree, findSceneNode } from '@/editor/sceneTree';
import { skeletonRootBone } from '@/editor/transformTarget';

/**
 * Object operations against a real working scene.
 *
 * Ownership is the load-bearing concern: imported geometry and materials come
 * from the immutable cache and must never be mutated or disposed, while
 * editor-created resources must be released exactly once.
 */

let working: WorkingScene;
let imported: { mesh: Mesh; material: MeshStandardMaterial; geometry: BufferGeometry };

function buildImportedAsset() {
  const material = new MeshStandardMaterial({ color: 0x334455 });
  const geometry = new BoxGeometry(1, 1, 1);
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ImportedBody';

  // A real rigged mesh, mirroring a glTF: the bones are SIBLINGS of the
  // skinned mesh under a shared armature node, not children of the mesh.
  const bone = new Bone();
  bone.name = 'root';
  const skinnedGeometry = new BoxGeometry(1, 1, 1, 2, 2, 2);
  const count = skinnedGeometry.attributes.position?.count ?? 0;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    skinIndices[i * 4] = 0;
    skinWeights[i * 4] = 1;
  }
  skinnedGeometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4));
  skinnedGeometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4));

  const skinned = new SkinnedMesh(skinnedGeometry, material);
  skinned.name = 'RiggedBody';
  skinned.bind(new Skeleton([bone]));

  const armature = new Group();
  armature.name = 'Armature';
  armature.add(bone);
  armature.add(skinned);
  armature.add(mesh);

  const scene = new Scene();
  scene.add(armature);
  return { scene, mesh, material, geometry, armature, skinned };
}

beforeEach(() => {
  const asset = buildImportedAsset();
  working = createWorkingScene(asset.scene, { idPrefix: 'op' });
  imported = { mesh: asset.mesh, material: asset.material, geometry: asset.geometry };
  // Resolve the WORKING copies (the working scene is a clone of the source).
  imported.mesh = collectByName(working.root, 'ImportedBody') as Mesh;
  imported.material = (imported.mesh.material as MeshStandardMaterial);
  imported.geometry = imported.mesh.geometry;
});

function collectByName(root: Object3D, name: string): Mesh | null {
  let found: Mesh | null = null;
  root.traverse((child) => {
    if (child.name === name && (child as Mesh).isMesh) found = child as Mesh;
  });
  return found;
}

function tree() {
  return buildSceneTree(working.root, working.registry);
}

function labelFor(id: string): string | undefined {
  return findSceneNode(tree(), id)?.label;
}

describe('createPrimitive', () => {
  it('creates real geometry registered under a unique id and named', () => {
    const result = createPrimitive(working, { kind: 'box' });
    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();

    const mesh = working.resolve(result.id!) as Mesh;
    expect(mesh.isMesh).toBe(true);
    expect(mesh.name).toBe('Box');
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(readPrimitiveMeta(mesh)?.kind).toBe('box');
    // Owned by the scene, so it will be disposed with it.
    expect(working.ownsGeometry(mesh.geometry)).toBe(true);
    working.dispose();
  });

  it('gives every created primitive a distinct id and unique name', () => {
    const first = createPrimitive(working, { kind: 'box' });
    const second = createPrimitive(working, { kind: 'box' });
    expect(first.id).not.toBe(second.id);

    const a = working.resolve(first.id!) as Mesh;
    const b = working.resolve(second.id!) as Mesh;
    expect(b.name).toBe('Box.001');
    expect(a.name).toBe('Box');
    working.dispose();
  });

  it('places the object at the requested world position', () => {
    const result = createPrimitive(working, { kind: 'sphere', position: new Vector3(1, 2, 3) });
    const mesh = working.resolve(result.id!) as Mesh;
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
    working.dispose();
  });

  it('never touches imported resources', () => {
    const geometrySpy = vi.spyOn(imported.geometry, 'dispose');
    const materialSpy = vi.spyOn(imported.material, 'dispose');
    createPrimitive(working, { kind: 'torus' });

    expect(geometrySpy).not.toHaveBeenCalled();
    expect(materialSpy).not.toHaveBeenCalled();
    working.dispose();
  });

  it('rejects invalid parameters without adding anything to the scene', () => {
    const before = working.root.children.length;
    const result = createPrimitive(working, {
      kind: 'box',
      params: { width: -1, height: 1, depth: 1 },
    });

    expect(result.ok).toBe(false);
    expect(working.root.children.length).toBe(before);
    working.dispose();
  });
});

describe('regeneratePrimitive', () => {
  it('rebuilds geometry while preserving identity and transform', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const mesh = working.resolve(created.id!) as Mesh;
    mesh.name = 'MyBox';
    mesh.position.set(4, 5, 6);
    mesh.scale.set(2, 2, 2);
    mesh.rotation.y = 0.5;

    const previousGeometry = mesh.geometry;
    const result = regeneratePrimitive(working, mesh, {
      width: 3,
      height: 3,
      depth: 3,
    });

    expect(result.ok).toBe(true);
    expect(mesh.name).toBe('MyBox');
    expect(mesh.position.toArray()).toEqual([4, 5, 6]);
    expect(mesh.scale.toArray()).toEqual([2, 2, 2]);
    expect(mesh.rotation.y).toBeCloseTo(0.5, 5);
    expect(working.registry.idOf(mesh)).toBe(created.id);

    // New geometry, recomputed bounds, and the old one released exactly once.
    expect(mesh.geometry).not.toBe(previousGeometry);
    expect(mesh.geometry.boundingBox).not.toBeNull();
    expect(mesh.geometry.boundingSphere).not.toBeNull();
    expect(result.disposedPrevious).toBe(true);
    expect(working.ownsGeometry(mesh.geometry)).toBe(true);
    expect(working.ownsGeometry(previousGeometry)).toBe(false);
    working.dispose();
  });

  it('updates the stored parameters', () => {
    const created = createPrimitive(working, { kind: 'cylinder' });
    const mesh = working.resolve(created.id!) as Mesh;

    regeneratePrimitive(working, mesh, {
      radiusTop: 2,
      radiusBottom: 1,
      height: 5,
      radialSegments: 16,
    });

    expect(readPrimitiveMeta(mesh)?.params).toEqual({
      radiusTop: 2,
      radiusBottom: 1,
      height: 5,
      radialSegments: 16,
    });
    working.dispose();
  });

  it('refuses to regenerate an imported mesh', () => {
    const result = regeneratePrimitive(working, imported.mesh, defaultParams('box'));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an editor primitive/i);
    working.dispose();
  });

  it('keeps imported geometry intact while a primitive is regenerated', () => {
    const spy = vi.spyOn(imported.geometry, 'dispose');
    const created = createPrimitive(working, { kind: 'box' });
    const mesh = working.resolve(created.id!) as Mesh;
    regeneratePrimitive(working, mesh, { width: 5, height: 5, depth: 5 });

    expect(spy).not.toHaveBeenCalled();
    working.dispose();
  });
});

describe('duplicateObject', () => {
  it('creates a distinct id, unique name and offset copy', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const source = working.resolve(created.id!) as Mesh;
    source.position.set(1, 0, 0);

    const result = duplicateObject(working, created.id!);
    expect(result.ok).toBe(true);
    expect(result.id).not.toBe(created.id);

    const copy = working.resolve(result.id!) as Mesh;
    expect(copy.name).toBe('Box.001');
    expect(copy.position.x).toBeCloseTo(1.5, 5);
    working.dispose();
  });

  it('gives the duplicate its own owned geometry so deleting one is safe', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const source = working.resolve(created.id!) as Mesh;
    const sourceGeometry = source.geometry;

    const result = duplicateObject(working, created.id!);
    const copy = working.resolve(result.id!) as Mesh;

    expect(copy.geometry).not.toBe(sourceGeometry);
    expect(working.ownsGeometry(copy.geometry)).toBe(true);
    expect(working.ownsGeometry(sourceGeometry)).toBe(true);

    // Deleting the duplicate must not touch the original's geometry.
    const sourceSpy = vi.spyOn(sourceGeometry, 'dispose');
    deleteObjects(working, [result.id!]);
    expect(sourceSpy).not.toHaveBeenCalled();
    working.dispose();
  });

  it('preserves primitive parameters and shares the material', () => {
    const created = createPrimitive(working, { kind: 'torus' });
    const source = working.resolve(created.id!) as Mesh;
    const result = duplicateObject(working, created.id!);
    const copy = working.resolve(result.id!) as Mesh;

    expect(readPrimitiveMeta(copy)?.params).toEqual(readPrimitiveMeta(source)?.params);
    // Material sharing is intentional: the scene owns it and disposes it once.
    expect(copy.material).toBe(source.material);
    working.dispose();
  });

  it('duplicating an imported mesh gives it an owned clone, never the cached one', () => {
    const id = working.registry.idOf(imported.mesh)!;
    const result = duplicateObject(working, id);
    expect(result.ok).toBe(true);

    const copy = working.resolve(result.id!) as Mesh;
    expect(copy.geometry).not.toBe(imported.geometry);
    expect(working.ownsGeometry(copy.geometry)).toBe(true);

    const sourceSpy = vi.spyOn(imported.geometry, 'dispose');
    deleteObjects(working, [result.id!]);
    expect(sourceSpy).not.toHaveBeenCalled();
    working.dispose();
  });

  it('refuses to duplicate rigged objects and explains why', () => {
    const rigged = collectByName(working.root, 'RiggedBody')!;
    const id = working.registry.idOf(rigged)!;
    const result = duplicateObject(working, id);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rigged/i);
    expect(canDuplicate(rigged).allowed).toBe(false);
    working.dispose();
  });
});

describe('deleteObjects', () => {
  it('removes the object from the graph, registry and hierarchy', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const result = deleteObjects(working, [created.id!]);

    expect(result.deleted).toEqual([created.id!]);
    expect(working.resolve(created.id!)).toBeNull();
    expect(working.registry.has(created.id!)).toBe(false);
    expect(findSceneNode(tree(), created.id!)).toBeNull();
    expect(labelFor(created.id!)).toBeUndefined();
    working.dispose();
  });

  it('disposes the owned geometry exactly once', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const mesh = working.resolve(created.id!) as Mesh;
    const spy = vi.spyOn(mesh.geometry, 'dispose');

    deleteObjects(working, [created.id!]);
    deleteObjects(working, [created.id!]);

    expect(spy).toHaveBeenCalledTimes(1);
    working.dispose();
  });

  it('never disposes cached imported geometry', () => {
    const spy = vi.spyOn(imported.geometry, 'dispose');
    const id = working.registry.idOf(imported.mesh)!;

    deleteObjects(working, [id]);

    expect(spy).not.toHaveBeenCalled();
    expect(imported.geometry.getAttribute('position').count).toBeGreaterThan(0);
    working.dispose();
  });

it('refuses to delete the scene root, bones and rig holders', () => {
    const rootResult = deleteObjects(working, [working.registry.idOf(working.root)!]);
    expect(rootResult.deleted).toHaveLength(0);
    expect(rootResult.skipped[0]?.reason).toMatch(/root/i);

    // The bone is a SIBLING of the skinned mesh, so find it on the armature.
    const armature = collectByName(working.root, 'RiggedBody')!.parent!;
    const bone = armature.children.find((child) => (child as Bone).isBone === true) as Bone;
    expect(bone).toBeTruthy();

    const boneResult = deleteObjects(working, [working.registry.idOf(bone)!]);
    expect(boneResult.deleted).toHaveLength(0);
    expect(boneResult.skipped[0]?.reason).toMatch(/bones/i);

    // The armature holds the bone, so deleting it would tear the rig apart.
    expect(canDelete(armature, working.root).allowed).toBe(false);
    expect(deleteObjects(working, [working.registry.idOf(armature)!]).deleted).toHaveLength(0);
    working.dispose();
  });

  it('deletes several objects at once and reports the ones it skipped', () => {
    const first = createPrimitive(working, { kind: 'box' });
    const second = createPrimitive(working, { kind: 'sphere' });
    const result = deleteObjects(working, [first.id!, second.id!]);

    expect(result.deleted).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    working.dispose();
  });
});

describe('renameObject', () => {
  it('renames without changing identity', () => {
    const created = createPrimitive(working, { kind: 'box' });
    const idBefore = working.registry.idOf(working.resolve(created.id!));

    const result = renameObject(working, created.id!, '  Hero Cube  ');
    expect(result.ok).toBe(true);
    expect(result.name).toBe('Hero Cube');
    expect(working.resolve(created.id!)?.name).toBe('Hero Cube');
    expect(working.registry.idOf(working.resolve(created.id!))).toBe(idBefore);
    expect(labelFor(created.id!)).toBe('Hero Cube');
    working.dispose();
  });

  it('rejects empty and whitespace-only names', () => {
    const created = createPrimitive(working, { kind: 'box' });
    expect(renameObject(working, created.id!, '').ok).toBe(false);
    expect(renameObject(working, created.id!, '    ').ok).toBe(false);
    expect(working.resolve(created.id!)?.name).toBe('Box');
    working.dispose();
  });

  it('allows duplicate names without colliding ids', () => {
    const a = createPrimitive(working, { kind: 'box' });
    const b = createPrimitive(working, { kind: 'sphere' });
    renameObject(working, a.id!, 'Same');
    renameObject(working, b.id!, 'Same');

    expect(working.resolve(a.id!)?.name).toBe('Same');
    expect(working.resolve(b.id!)?.name).toBe('Same');
    expect(a.id).not.toBe(b.id);
    working.dispose();
  });
});

describe('visibility', () => {
  it('toggles the real object and keeps it registered', () => {
    const created = createPrimitive(working, { kind: 'box' });
    setObjectVisibility(working, created.id!, false);

    const mesh = working.resolve(created.id!) as Mesh;
    expect(mesh.visible).toBe(false);
    expect(working.registry.has(created.id!)).toBe(true);
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(findSceneNode(tree(), created.id!)?.visible).toBe(false);
    working.dispose();
  });
});

describe('group and ungroup', () => {
  it('creates a real Group and preserves world transforms', () => {
    const a = createPrimitive(working, { kind: 'box', position: new Vector3(1, 0, 0) });
    const b = createPrimitive(working, { kind: 'sphere', position: new Vector3(0, 2, 0) });
    const meshA = working.resolve(a.id!) as Mesh;
    const meshB = working.resolve(b.id!) as Mesh;
    const worldA = meshA.position.clone();
    const worldB = meshB.position.clone();

    const result = groupObjects(working, [a.id!, b.id!]);
    expect(result.ok).toBe(true);

    const group = working.resolve(result.id!) as Group;
    expect(group.isGroup).toBe(true);
    expect(group.name).toBe('Group');
    expect(meshA.parent).toBe(group);
    expect(meshB.parent).toBe(group);

    // World positions are unchanged by reparenting.
    meshA.updateWorldMatrix(true, false);
    meshB.updateWorldMatrix(true, false);
    expect(meshA.getWorldPosition(new Vector3()).toArray()).toEqual(worldA.toArray());
    expect(meshB.getWorldPosition(new Vector3()).toArray()).toEqual(worldB.toArray());

    // The hierarchy reflects the new nesting.
    const node = findSceneNode(tree(), result.id!);
    expect(node?.kind).toBe('group');
    expect(node?.children).toHaveLength(2);
    working.dispose();
  });

  it('preserves world transforms of children under a rotated parent on ungroup', () => {
    const a = createPrimitive(working, { kind: 'box', position: new Vector3(2, 1, 0) });
    const b = createPrimitive(working, { kind: 'sphere', position: new Vector3(-1, 3, 2) });
    const grouped = groupObjects(working, [a.id!, b.id!]);

    // Rotate and move the group, then read world positions.
    const group = working.resolve(grouped.id!) as Group;
    group.rotation.y = Math.PI / 3;
    group.position.set(1, 1, 1);
    group.updateMatrixWorld(true);

    const meshA = working.resolve(a.id!) as Mesh;
    const meshB = working.resolve(b.id!) as Mesh;
    meshA.updateWorldMatrix(true, false);
    meshB.updateWorldMatrix(true, false);
    const worldA = meshA.getWorldPosition(new Vector3());
    const worldB = meshB.getWorldPosition(new Vector3());

    const result = ungroupObject(working, grouped.id!);
    expect(result.ok).toBe(true);

    expect(meshA.parent).toBe(working.root);
    expect(meshB.parent).toBe(working.root);
    meshA.updateWorldMatrix(true, false);
    meshB.updateWorldMatrix(true, false);
    expect(meshA.getWorldPosition(new Vector3()).distanceTo(worldA)).toBeLessThan(1e-5);
    expect(meshB.getWorldPosition(new Vector3()).distanceTo(worldB)).toBeLessThan(1e-5);
    working.dispose();
  });

  it('restores sibling order on ungroup', () => {
    const before = createPrimitive(working, { kind: 'box' });
    const groupedA = createPrimitive(working, { kind: 'sphere' });
    const groupedB = createPrimitive(working, { kind: 'cone' });
    const after = createPrimitive(working, { kind: 'torus' });

    const result = groupObjects(working, [groupedA.id!, groupedB.id!]);
    ungroupObject(working, result.id!);

    const names = working.root.children.map((child) => child.name);
    const indexOfSphere = names.indexOf('Sphere');
    const indexOfCone = names.indexOf('Cone');
    expect(indexOfCone).toBe(indexOfSphere + 1);
    expect(names.indexOf('Box')).toBeLessThan(indexOfSphere);
    expect(names.indexOf('Torus')).toBeGreaterThan(indexOfCone);
    expect(working.resolve(before.id!)).not.toBeNull();
    expect(working.resolve(after.id!)).not.toBeNull();
    working.dispose();
  });

  it('refuses to group fewer than two objects', () => {
    const only = createPrimitive(working, { kind: 'box' });
    const result = groupObjects(working, [only.id!]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least two/i);
    working.dispose();
  });

it('refuses to group rigged objects', () => {
    const rigged = collectByName(working.root, 'RiggedBody')!;
    const group = new Group();
    working.root.add(group);
    group.add(rigged);
    group.updateMatrixWorld(true);

    const riggedId = working.registry.idOf(rigged)!;
    const groupId = working.registry.idOf(group)!;

    const result = groupObjects(working, [riggedId, groupId]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rig|skin/i);
    working.dispose();
  });

  it('refuses to ungroup a group holding rig elements', () => {
    const armature = collectByName(working.root, 'RiggedBody')!.parent!;
    const id = working.registry.idOf(armature)!;
    expect(canUngroup(armature).allowed).toBe(false);
    expect(ungroupObject(working, id).ok).toBe(false);
    working.dispose();
  });

  it('refuses to ungroup a non-group', () => {
    const created = createPrimitive(working, { kind: 'box' });
    expect(canUngroup(working.resolve(created.id!)).allowed).toBe(false);
    expect(ungroupObject(working, created.id!).ok).toBe(false);
    working.dispose();
  });

  it('does not dispose the children when ungrouping', () => {
    const a = createPrimitive(working, { kind: 'box' });
    const meshA = working.resolve(a.id!) as Mesh;
    const geometrySpy = vi.spyOn(meshA.geometry, 'dispose');
    const result = groupObjects(working, [a.id!]);

    ungroupObject(working, result.id!);

    expect(geometrySpy).not.toHaveBeenCalled();
    expect(working.resolve(a.id!)).toBe(meshA);
    working.dispose();
  });
});

describe('uniqueName', () => {
it('appends a zero-padded counter', () => {
    const parent = new Group();
    expect(uniqueName(parent, 'Box')).toBe('Box');

    const first = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    first.name = 'Box';
    parent.add(first);
    expect(uniqueName(parent, 'Box')).toBe('Box.001');

    const second = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    second.name = 'Box.001';
    parent.add(second);
    expect(uniqueName(parent, 'Box')).toBe('Box.002');

    const third = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    third.name = 'Box.002';
    parent.add(third);
    expect(uniqueName(parent, 'Box')).toBe('Box.003');

    const fourth = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    fourth.name = 'Box.003';
    parent.add(fourth);
    expect(uniqueName(parent, 'Box')).toBe('Box.004');
  });
});

describe('rig helpers', () => {
  it('finds the skeleton root of the imported rig', () => {
    const rigged = collectByName(working.root, 'RiggedBody')!;
    expect(skeletonRootBone(rigged)?.name).toBe('root');
    expect(canGroup(rigged).allowed).toBe(false);
    working.dispose();
  });
});

describe('every primitive kind survives create -> duplicate -> delete', () => {
  it('does not leak owned geometry', () => {
    for (const kind of ['box', 'sphere', 'plane', 'cylinder', 'cone', 'torus'] as PrimitiveKind[]) {
      const created = createPrimitive(working, { kind });
      const copy = duplicateObject(working, created.id!);
      expect(copy.ok).toBe(true);
      expect(working.ownedGeometries.size).toBeGreaterThan(0);

      deleteObjects(working, [copy.id!, created.id!]);
      expect(working.registry.has(created.id!)).toBe(false);
      expect(working.registry.has(copy.id!)).toBe(false);
    }
    // Every owned geometry was released by the deletions.
    expect(working.ownedGeometries.size).toBe(0);
    working.dispose();
  });
});


