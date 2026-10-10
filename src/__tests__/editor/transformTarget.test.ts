import { describe, it, expect } from 'vitest';
import {
  BoxGeometry,
  BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Skeleton,
  SkinnedMesh,
  Bone,
  Vector3,
} from 'three';
import {
  createTransformRig,
  resolveTransformTarget,
  skeletonRootBone,
} from '@/editor/transformTarget';

/**
 * Regression tests for the "ghost transform" defect.
 *
 * A glTF stores a rigged mesh node as a SIBLING of its bones. three.js renders
 * skinned vertices from world-space bone matrices, so the mesh node's own
 * transform does not move the geometry - only the skeleton does.
 */

/** Mirrors the Cesium Man layout: Armature -> [boneRoot, mesh]. */
function buildRiggedAsset() {
  const boneRoot = new Bone();
  boneRoot.name = 'root';
  const knee = new Bone();
  knee.name = 'knee';
  knee.position.set(0, 0.5, 0);
  boneRoot.add(knee);

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

  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = 'Body';
  mesh.position.set(2, 0, 0); // authored offset from the bone root
  mesh.bind(new Skeleton([boneRoot, knee]));

  const armature = new Group();
  armature.name = 'Armature';
  // Sibling ordering exactly as the glTF has it: bones and mesh are siblings.
  armature.add(boneRoot);
  armature.add(mesh);

  const scene = new Scene();
  scene.add(armature);
  return { scene, armature, boneRoot, knee, mesh };
}

describe('skeletonRootBone', () => {
  it('returns null for an ordinary mesh', () => {
    expect(skeletonRootBone(new Mesh())).toBeNull();
    expect(skeletonRootBone(null)).toBeNull();
    expect(skeletonRootBone(undefined)).toBeNull();
  });

  it('returns null for a group', () => {
    expect(skeletonRootBone(new Group())).toBeNull();
  });

  it('finds the topmost bone of a skeleton whose bones are siblings of the mesh', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    expect(skeletonRootBone(mesh)).toBe(boneRoot);
  });

  it('picks the bone whose parent is outside the skeleton', () => {
    const { mesh, boneRoot, knee } = buildRiggedAsset();
    // Reorder so the child bone appears first in the bone list.
    mesh.skeleton.bones = [knee, boneRoot];
    expect(skeletonRootBone(mesh)).toBe(boneRoot);
  });
});

describe('resolveTransformTarget', () => {
  it('drives an ordinary mesh directly', () => {
    const mesh = new Mesh();
    const target = resolveTransformTarget(mesh);

    expect(target?.driver).toBe(mesh);
    expect(target?.follower).toBeNull();
    expect(target?.isSkeletal).toBe(false);
  });

  it('drives a rigged mesh through its skeleton root, keeping the mesh in sync', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    const target = resolveTransformTarget(mesh);

    // The driver must NOT be the mesh node - that is the ghost bug.
    expect(target?.driver).toBe(boneRoot);
    expect(target?.driver).not.toBe(mesh);
    expect(target?.follower).toBe(mesh);
    expect(target?.isSkeletal).toBe(true);
  });

  it('returns null for a missing object', () => {
    expect(resolveTransformTarget(null)).toBeNull();
  });
});

describe('createTransformRig', () => {
  it('applies the driver delta to the follower', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    const rig = createTransformRig(boneRoot, mesh);
    rig.begin();

    boneRoot.position.set(0, 4, 0);
    boneRoot.updateMatrixWorld(true);
    rig.sync();

    // The mesh receives the same world-space offset, keeping its authored 2-unit X.
    expect(mesh.position.x).toBeCloseTo(2, 5);
    expect(mesh.position.y).toBeCloseTo(4, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('mirrors rotation onto the follower', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    const rig = createTransformRig(boneRoot, mesh);
    rig.begin();

    boneRoot.rotation.y = Math.PI / 3;
    boneRoot.updateMatrixWorld(true);
    rig.sync();

    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 3, 5);
    expect(mesh.quaternion.y).toBeCloseTo(Math.sin(Math.PI / 6), 5);
  });

  it('mirrors non-uniform scale onto the follower', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    const rig = createTransformRig(boneRoot, mesh);
    rig.begin();

    boneRoot.scale.set(2, 3, 4);
    boneRoot.updateMatrixWorld(true);
    rig.sync();

    expect(mesh.scale.toArray().map((n) => +n.toFixed(5))).toEqual([2, 3, 4]);
  });

  it('is a no-op for the follower before begin() is called', () => {
    const { boneRoot, mesh } = buildRiggedAsset();
    const rig = createTransformRig(boneRoot, mesh);

    boneRoot.position.set(0, 9, 0);
    boneRoot.updateMatrixWorld(true);
    rig.sync();

    // Baseline unknown, so the mesh must not be snapped to the bone.
    expect(mesh.position.y).toBe(0);
  });

  it('measures each drag from the pose it started at', () => {
    const { boneRoot, mesh } = buildRiggedAsset();

    // First drag.
    let rig = createTransformRig(boneRoot, mesh);
    rig.begin();
    boneRoot.position.set(0, 4, 0);
    boneRoot.updateMatrixWorld(true);
    rig.sync();
    expect(mesh.position.y).toBeCloseTo(4, 5);

    // Second drag must be relative to the new pose, not cumulative from origin.
    rig = createTransformRig(boneRoot, mesh);
    rig.begin();
    boneRoot.position.set(0, 6, 0);
    boneRoot.updateMatrixWorld(true);
    rig.sync();
    expect(mesh.position.y).toBeCloseTo(6, 5);
  });

  it('works when the follower has a rotated parent', () => {
    const boneRoot = new Bone();
    const geometry = new BoxGeometry(1, 1, 1, 2, 2, 2);
    const count = geometry.attributes.position?.count ?? 0;
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      si[i * 4] = 0;
      sw[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new BufferAttribute(si, 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(sw, 4));
    const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
    mesh.bind(new Skeleton([boneRoot]));

    // Different parents with different transforms.
    const boneParent = new Group();
    boneParent.name = 'Bones';
    const meshParent = new Group();
    meshParent.name = 'Meshes';
    meshParent.rotation.y = Math.PI / 2;
    meshParent.position.set(0, 0, 5);
    boneParent.add(boneRoot);
    meshParent.add(mesh);
    const scene = new Scene();
    scene.add(boneParent, meshParent);

    const rig = createTransformRig(boneRoot, mesh);
    rig.begin();
    boneRoot.position.set(3, 0, 0);
    boneRoot.updateMatrixWorld(true);
    rig.sync();

    // World-space relationship between bone and mesh must be preserved.
    const boneWorld = new Vector3().setFromMatrixPosition(boneRoot.matrixWorld);
    const meshWorld = new Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const startDelta = new Vector3(0, 0, 5);
    expect(meshWorld.clone().sub(boneWorld)).toEqual(startDelta.clone());
  });

  it('does not throw when the follower has no parent', () => {
    const boneRoot = new Bone();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const rig = createTransformRig(boneRoot, mesh);
    rig.begin();
    boneRoot.position.set(1, 2, 3);
    boneRoot.updateMatrixWorld(true);
    expect(() => rig.sync()).not.toThrow();
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
  });

  it('is safe when the driver has no follower', () => {
    const mesh = new Mesh();
    const rig = createTransformRig(mesh, null);
    rig.begin();
    mesh.position.set(5, 5, 5);
    mesh.updateMatrixWorld(true);
    expect(() => rig.sync()).not.toThrow();
  });
});