import { Matrix4 } from 'three';
import type { Bone, Object3D, SkinnedMesh } from 'three';

/**
 * Transform targets for imported assets.
 *
 * ============================ WHY THIS MODULE EXISTS ===========================
 * A glTF rigged mesh stores its mesh node and its bones as SIBLINGS under a
 * common armature node (Cesium Man: `Armature` -> [`Skeleton_torso_joint_1...`,
 * `Cesium_Man`]). three.js renders skinned vertices from
 * `Skeleton.update()`, which produces WORLD-space matrices
 * (`bone.matrixWorld * boneInverse`), and `bindMatrix` / `bindMatrixInverse`
 * are captured once at bind time and never change afterwards.
 *
 * The consequence is that the SkinnedMesh NODE's own position / quaternion /
 * scale has NO effect on the rendered skinned geometry. It only affects:
 *   1. frustum culling, which uses `geometry.boundingSphere * matrixWorld`
 *   2. any non-skinned children of that node
 *
 * Transforming the mesh node therefore produces exactly the "ghost" behaviour:
 * an outline or gizmo helper attached to it moves, while the textured model
 * stays put - and translating far enough slides the culling sphere out of the
 * frustum so the model disappears entirely.
 *
 * The only correct way to move a rigged character is to move its skeleton.
 * So for a SkinnedMesh the transform DRIVER is the skeleton root bone, and the
 * mesh node is kept in sync as a FOLLOWER so culling bounds and selection
 * helpers continue to follow the geometry.
 * ============================================================================
 */

export interface TransformTarget {
  /** The object whose transform actually moves the rendered geometry. */
  driver: Object3D;
  /**
   * Object kept in lock-step with the driver so frustum culling and selection
   * helpers track the real geometry. Null for ordinary meshes, which are their
   * own driver.
   */
  follower: Object3D | null;
  /** True when the driver is a skeleton root rather than the selected mesh. */
  isSkeletal: boolean;
}

/**
 * Returns the topmost bone of a skeleton's hierarchy, i.e. the one whose parent
 * is not itself part of the skeleton. Returns null for non-skinned objects and
 * for skeletons with no usable bones.
 */
export function skeletonRootBone(mesh: Object3D | null | undefined): Bone | null {
  const candidate = mesh as Partial<SkinnedMesh> | null | undefined;
  if (!candidate || candidate.isSkinnedMesh !== true) return null;

  const skeleton = candidate.skeleton;
  const bones = skeleton?.bones;
  if (!bones || bones.length === 0) return null;

  const inSkeleton = new Set<Object3D>(bones);
  for (const bone of bones) {
    if (bone.parent && !inSkeleton.has(bone.parent)) return bone;
  }
  // Every bone is parented to another bone (or nothing at all): fall back to
  // the first bone, which is the skeleton's declared root.
  return bones[0] ?? null;
}

/**
 * Resolves which object must be transformed for a selected object to visibly
 * move. Ordinary meshes drive themselves; rigged meshes are driven through
 * their skeleton root.
 */
export function resolveTransformTarget(object: Object3D | null | undefined): TransformTarget | null {
  if (!object) return null;
  const root = skeletonRootBone(object);
  if (!root) return { driver: object, follower: null, isSkeletal: false };
  return { driver: root, follower: object, isSkeletal: true };
}

export interface TransformRig {
  driver: Object3D;
  follower: Object3D | null;
  /** Captures the baseline world matrices. Call on selection change / drag start. */
  begin: () => void;
  /**
   * Applies the driver's world-space delta to the follower, so the mesh node
   * keeps the same world relationship it had before the transform.
   */
  sync: () => void;
}

const _delta = new Matrix4();
const _driverInverseStart = new Matrix4();
const _world = new Matrix4();
const _parentInverse = new Matrix4();

/**
 * Creates a rig that keeps `follower` aligned with `driver`.
 *
 * The follower is offset by the SAME world-space delta the driver received -
 * it is never snapped to the driver's absolute transform - which preserves the
 * authored relationship between an armature node and its mesh node.
 */
export function createTransformRig(
  driver: Object3D,
  follower: Object3D | null,
): TransformRig {
  let driverWorldStart: Matrix4 | null = null;
  let followerWorldStart: Matrix4 | null = null;

  const begin = () => {
    driver.updateWorldMatrix(true, false);
    driverWorldStart = driver.matrixWorld.clone();
    if (follower) {
      follower.updateWorldMatrix(true, false);
      followerWorldStart = follower.matrixWorld.clone();
    } else {
      followerWorldStart = null;
    }
  };

  const sync = () => {
    if (!follower || !driverWorldStart || !followerWorldStart) return;

    driver.updateWorldMatrix(true, false);

    // delta = current driver world * inverse(start driver world)
    _driverInverseStart.copy(driverWorldStart).invert();
    _delta.multiplyMatrices(driver.matrixWorld, _driverInverseStart);

    // follower world = delta * follower start world, then into parent space.
    _world.multiplyMatrices(_delta, followerWorldStart);

    const parent = follower.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      _parentInverse.copy(parent.matrixWorld).invert();
      _world.premultiply(_parentInverse);
    }

    _world.decompose(follower.position, follower.quaternion, follower.scale);
    follower.updateMatrixWorld(true);
  };

  return { driver, follower, begin, sync };
}