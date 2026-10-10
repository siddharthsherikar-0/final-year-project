import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Scene,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
} from 'three';
import { createWorkingScene } from '@/editor/workingScene';

/**
 * Working-scene ownership contract.
 *
 * The load-bearing guarantee is that the cached GLTF source is never mutated
 * and never disposed. These tests are deliberately written against the exact
 * failure modes found in the Stage 9A audit.
 */

function makeSkinnedSource(): Scene {
  const geometry = new BoxGeometry(1, 1, 1, 2, 2, 2);
  const count = geometry.attributes.position?.count ?? 0;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    skinIndices[i * 4] = 0;
    skinWeights[i * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4));

  const root = new Bone();
  root.name = 'root';
  const tip = new Bone();
  tip.name = 'tip';
  tip.position.set(0, 1, 0);
  root.add(tip);

  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = 'SkinnedBody';
  mesh.add(root);
  mesh.bind(new Skeleton([root, tip]));

  const scene = new Scene();
  scene.name = 'Asset';
  scene.add(mesh);
  return scene;
}

function collectMaterials(root: Scene | Group): MeshStandardMaterial[] {
  const found: MeshStandardMaterial[] = [];
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const entry of list) found.push(entry as MeshStandardMaterial);
  });
  return found;
}

describe('createWorkingScene - source immutability', () => {
  it('returns a working root that is not the cached source object', () => {
    const source = makeSkinnedSource();
    const working = createWorkingScene(source, { idPrefix: 'test' });

    expect(working.root).not.toBe(source);
    expect(source.children.length).toBe(1);
    expect(working.root.children.length).toBe(1);
    working.dispose();
  });

  it('leaves the source object graph completely unchanged after cloning', () => {
    const source = makeSkinnedSource();
    const sourceMesh = source.children[0] as SkinnedMesh;
    const sourceMaterial = sourceMesh.material as MeshStandardMaterial;
    const before = {
      children: source.children.length,
      meshPosition: sourceMesh.position.toArray(),
      materialColor: sourceMaterial.color.getHexString(),
      materialRoughness: sourceMaterial.roughness,
      wireframe: sourceMaterial.wireframe,
    };

    const working = createWorkingScene(source, { idPrefix: 'test' });

    expect(source.children.length).toBe(before.children);
    expect(sourceMesh.position.toArray()).toEqual(before.meshPosition);
    expect(sourceMaterial.color.getHexString()).toBe(before.materialColor);
    expect(sourceMaterial.roughness).toBe(before.materialRoughness);
    expect(sourceMaterial.wireframe).toBe(before.wireframe);
    working.dispose();
  });

  it('gives every working node its own identity', () => {
    const source = makeSkinnedSource();
    const working = createWorkingScene(source, { idPrefix: 'test' });

    let sourceMesh: Mesh | null = null;
    source.traverse((child) => {
      if ((child as Mesh).isMesh) sourceMesh = child as Mesh;
    });

    const workingMeshes = collectMeshes(working.root);
    expect(workingMeshes).toHaveLength(1);
    expect(workingMeshes[0]).not.toBe(sourceMesh);
    expect(workingMeshes[0]?.name).toBe('SkinnedBody');
    working.dispose();
  });
});

function collectMeshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((child) => {
    if ((child as Mesh).isMesh) found.push(child as Mesh);
  });
  return found;
}

describe('createWorkingScene - material ownership', () => {
  it('never shares a material reference with the source', () => {
    const sourceMaterial = new MeshStandardMaterial({ color: new Color('#ff0000') });
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), sourceMaterial));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);

    expect(workingMaterial).toBeDefined();
    expect(workingMaterial).not.toBe(sourceMaterial);
    working.dispose();
  });

  it('keeps shared source materials shared as ONE working material', () => {
    const shared = new MeshStandardMaterial({ color: new Color('#00ff00') });
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), shared));
    source.add(new Mesh(new SphereGeometry(1, 8, 6), shared));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const materials = collectMaterials(working.root);

    expect(materials).toHaveLength(2);
    // Intra-scene sharing semantics must survive the ownership layer.
    expect(materials[0]).toBe(materials[1]);
    expect(working.ownedMaterials.size).toBe(1);
    working.dispose();
  });

  it('gives distinct source materials distinct working materials', () => {
    const a = new MeshStandardMaterial();
    const b = new MeshStandardMaterial();
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), a));
    source.add(new Mesh(new SphereGeometry(1, 8, 6), b));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const materials = collectMaterials(working.root);

    expect(materials[0]).not.toBe(materials[1]);
    expect(working.ownedMaterials.size).toBe(2);
    working.dispose();
  });

  it('clones material arrays element-wise', () => {
    const a = new MeshStandardMaterial();
    const b = new MeshStandardMaterial();
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), [a, b]));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [mesh] = collectMeshes(working.root);
    const materials = mesh?.material as MeshStandardMaterial[];

    expect(Array.isArray(materials)).toBe(true);
    expect(materials).toHaveLength(2);
    expect(materials[0]).not.toBe(a);
    expect(materials[1]).not.toBe(b);
    // Elements keep the shared relationship of the original array.
    expect(materials[0]).toBe(working.materialMap.get(a));
    expect(materials[1]).toBe(working.materialMap.get(b));
    working.dispose();
  });

  it('copies material property values so editing starts from the source values', () => {
    const sourceMaterial = new MeshStandardMaterial({
      color: new Color('#123456'),
      roughness: 0.42,
      metalness: 0.13,
    });
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), sourceMaterial));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);

    expect(workingMaterial?.color.getHexString()).toBe('123456');
    expect(workingMaterial?.roughness).toBeCloseTo(0.42, 5);
    expect(workingMaterial?.metalness).toBeCloseTo(0.13, 5);
    working.dispose();
  });
});

describe('createWorkingScene - the Stage 8 wireframe/cache defect', () => {
  it('does not leak a wireframe toggle back into the cached source material', () => {
    const cachedMaterial = new MeshStandardMaterial({ color: new Color('#ffffff') });
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), cachedMaterial));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);

    // This is exactly what ModelMesh does when the user toggles wireframe.
    workingMaterial!.wireframe = true;

    expect(workingMaterial!.wireframe).toBe(true);
    // Before the ownership layer this was the SAME object and became true too.
    expect(cachedMaterial.wireframe).toBe(false);
    working.dispose();
  });

  it('does not leak other material edits back into the source', () => {
    const cachedMaterial = new MeshStandardMaterial({ color: new Color('#ffffff') });
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), cachedMaterial));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);

    workingMaterial!.color.set('#00ff00');
    workingMaterial!.roughness = 0.9;
    workingMaterial!.side = 2;

expect(cachedMaterial.color.getHexString()).toBe('ffffff');
    expect(cachedMaterial.roughness).toBe(1);
    // FrontSide is 0; the working copy was pushed to DoubleSide (2).
    expect(workingMaterial!.side).toBe(2);
    expect(cachedMaterial.side).toBe(0);
    working.dispose();
  });
});

describe('createWorkingScene - geometry ownership', () => {
  it('shares imported geometry read-only instead of duplicating it', () => {
    const sharedGeometry = new BoxGeometry(1, 1, 1);
    const source = new Scene();
    source.add(new Mesh(sharedGeometry, new MeshStandardMaterial()));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [mesh] = collectMeshes(working.root);

    expect(mesh?.geometry).toBe(sharedGeometry);
    expect(working.ownedGeometries.size).toBe(0);
    working.dispose();
  });

  it('clones geometry on demand and stops sharing it', () => {
    const sharedGeometry = new BoxGeometry(1, 1, 1);
    const source = new Scene();
    source.add(new Mesh(sharedGeometry, new MeshStandardMaterial()));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [mesh] = collectMeshes(working.root);

    const owned = working.takeOwnershipOfGeometry(mesh!);

    expect(owned).not.toBe(sharedGeometry);
    expect(mesh!.geometry).toBe(owned);
    expect(working.ownedGeometries.has(owned)).toBe(true);
    // The source geometry is untouched by any edit made to the owned copy.
    expect(sharedGeometry.parameters.width).toBe(1);
    working.dispose();
  });

  it('is idempotent: taking ownership twice keeps one owned geometry', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [mesh] = collectMeshes(working.root);

    const first = working.takeOwnershipOfGeometry(mesh!);
    const second = working.takeOwnershipOfGeometry(mesh!);

    expect(second).toBe(first);
    expect(working.ownedGeometries.size).toBe(1);
    working.dispose();
  });
});

describe('createWorkingScene - skinned meshes', () => {
  it('rebinds the skeleton to cloned bones and keeps the source bone out of it', () => {
    const source = makeSkinnedSource();
    const working = createWorkingScene(source, { idPrefix: 'test' });

    const sourceMesh = collectMeshes(source)[0] as SkinnedMesh;
    const workingMesh = collectMeshes(working.root)[0] as SkinnedMesh;

    expect(workingMesh.isSkinnedMesh).toBe(true);
    expect(workingMesh.skeleton).not.toBe(sourceMesh.skeleton);
    expect(workingMesh.skeleton.bones).toHaveLength(2);
    // Bones must belong to the working tree, never to the cached source.
    for (const bone of workingMesh.skeleton.bones) {
      expect(sourceMesh.skeleton.bones).not.toContain(bone);
    }
    working.dispose();
  });

  it('lets the working skeleton be posed without touching the source skeleton', () => {
    const source = makeSkinnedSource();
    const sourceMesh = collectMeshes(source)[0] as SkinnedMesh;
    const sourceBoneRotation = sourceMesh.skeleton.bones[0]?.rotation.y ?? 0;

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const workingMesh = collectMeshes(working.root)[0] as SkinnedMesh;
    const workingBone = workingMesh.skeleton.bones[0];

    workingBone!.rotation.y = Math.PI / 2;
    workingBone!.updateMatrixWorld(true);

    expect(sourceMesh.skeleton.bones[0]?.rotation.y).toBe(sourceBoneRotation);
    working.dispose();
  });

  it('shares imported skinned geometry read-only', () => {
    const source = makeSkinnedSource();
    const sourceGeometry = collectMeshes(source)[0]?.geometry;
    const working = createWorkingScene(source, { idPrefix: 'test' });

    expect(collectMeshes(working.root)[0]?.geometry).toBe(sourceGeometry);
    working.dispose();
  });
});

describe('createWorkingScene - disposal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disposes only the materials it owns', () => {
    const cachedMaterial = new MeshStandardMaterial();
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), cachedMaterial));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);

    const ownedSpy = vi.spyOn(workingMaterial!, 'dispose');
    const cachedSpy = vi.spyOn(cachedMaterial, 'dispose');

    working.dispose();

    expect(ownedSpy).toHaveBeenCalledTimes(1);
    expect(cachedSpy).not.toHaveBeenCalled();
  });

  it('never disposes shared source geometry', () => {
    const sharedGeometry = new BoxGeometry(1, 1, 1);
    const source = new Scene();
    source.add(new Mesh(sharedGeometry, new MeshStandardMaterial()));

    const working = createWorkingScene(source, { idPrefix: 'test' });
    const geometrySpy = vi.spyOn(sharedGeometry, 'dispose');

    working.dispose();

    expect(geometrySpy).not.toHaveBeenCalled();
  });

  it('disposes an owned geometry it created through copy-on-write', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [mesh] = collectMeshes(working.root);

    const owned = working.takeOwnershipOfGeometry(mesh!);
    const ownedSpy = vi.spyOn(owned, 'dispose');

    working.dispose();

    expect(ownedSpy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and reports its disposed state', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const working = createWorkingScene(source, { idPrefix: 'test' });
    const [workingMaterial] = collectMaterials(working.root);
    const spy = vi.spyOn(workingMaterial!, 'dispose');

    expect(working.disposed).toBe(false);
    working.dispose();
    working.dispose();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(working.disposed).toBe(true);
  });

  it('stops resolving ids and detaches the tree after disposal', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const parent = new Group();
    const working = createWorkingScene(source, { idPrefix: 'test' });
    const id = working.registry.ids().find((entry) => entry !== `${working.idPrefix}-1`);
    parent.add(working.root);

    expect(parent.children).toContain(working.root);
    working.dispose();

    expect(parent.children).not.toContain(working.root);
    expect(working.registry.size).toBe(0);
    expect(working.resolve(id ?? 'nope')).toBeNull();
  });

  it('releases owned resources on model switch without touching the new scene', () => {
    const materialA = new MeshBasicMaterial();
    const sourceA = new Scene();
    sourceA.add(new Mesh(new BoxGeometry(), materialA));

    const first = createWorkingScene(sourceA, { idPrefix: 'a' });
    const [ownedMaterialA] = collectMaterials(first.root);
    const disposeA = vi.spyOn(ownedMaterialA!, 'dispose');

    // Model switch: the previous working scene is disposed...
    first.dispose();

    // ...and a brand new one is built from a different asset.
    const materialB = new MeshStandardMaterial();
    const sourceB = new Scene();
    sourceB.add(new Mesh(new SphereGeometry(1, 8, 6), materialB));
    const second = createWorkingScene(sourceB, { idPrefix: 'b' });
    const cachedBSpy = vi.spyOn(materialB, 'dispose');
    const [ownedMaterialB] = collectMaterials(second.root);
    const disposeB = vi.spyOn(ownedMaterialB!, 'dispose');

    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(disposeB).not.toHaveBeenCalled();
    // The second scene's cached source is untouched by the first scene's teardown.
    expect(cachedBSpy).not.toHaveBeenCalled();

    second.dispose();
    expect(disposeB).toHaveBeenCalledTimes(1);
    expect(cachedBSpy).not.toHaveBeenCalled();
  });

  it('never disposes a source material that two viewers share', () => {
    const shared = new MeshStandardMaterial();
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), shared));

    const viewerA = createWorkingScene(source, { idPrefix: 'a' });
    const viewerB = createWorkingScene(source, { idPrefix: 'b' });
    const cachedSpy = vi.spyOn(shared, 'dispose');

    viewerA.dispose();

    // Viewer B still has a fully valid owned material.
    const [materialB] = collectMaterials(viewerB.root);
    expect(cachedSpy).not.toHaveBeenCalled();
    expect(materialB?.color).toBeDefined();
    viewerB.dispose();
  });
});

describe('createWorkingScene - id prefixing', () => {
  it('scopes ids to the scene so two scenes never collide', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));

    const first = createWorkingScene(source, { idPrefix: 'a' });
    const second = createWorkingScene(source, { idPrefix: 'b' });

    const firstId = first.registry.ids()[0];
    const secondId = second.registry.ids()[0];

    expect(firstId?.startsWith('a-')).toBe(true);
    expect(secondId?.startsWith('b-')).toBe(true);
    // A stale id from scene A must not resolve against scene B.
    expect(second.resolve(firstId ?? '')).toBeNull();

    first.dispose();
    second.dispose();
  });

  it('generates a non-empty prefix when none is supplied', () => {
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const working = createWorkingScene(source);

    expect(working.idPrefix.length).toBeGreaterThan(0);
    expect(working.registry.ids()[0]).toContain(working.idPrefix);
    working.dispose();
  });
});


