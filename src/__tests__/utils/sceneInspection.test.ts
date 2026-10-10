import { describe, it, expect } from 'vitest';
import {
  AnimationClip,
  BufferAttribute,
  Box3,
  Vector3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  SphereGeometry,
} from 'three';
import { MAX_INSPECTED_NAMES, describeScene } from '@/utils/sceneInspection';

function mesh(
  geometry: BoxGeometry | SphereGeometry = new BoxGeometry(1, 1, 1),
  material: Mesh['material'] = new MeshStandardMaterial(),
): Mesh {
  return new Mesh(geometry, material);
}

function clip(name: string): AnimationClip {
  return { name, duration: 1, tracks: [] } as unknown as AnimationClip;
}

describe('describeScene', () => {
  it('returns null when there is no root at all', () => {
    expect(describeScene(null)).toBeNull();
    expect(describeScene(undefined)).toBeNull();
  });

  it('handles an empty scene without throwing', () => {
    const result = describeScene(new Group());
    expect(result).not.toBeNull();
    expect(result?.meshCount).toBe(0);
    expect(result?.materialCount).toBe(0);
    expect(result?.triangleCount).toBeNull();
    expect(result?.dimensions).toBeNull();
    expect(result?.largestAxis).toBeNull();
    expect(result?.materials).toEqual([]);
  });

  it('describes a single mesh', () => {
    const result = describeScene(mesh(new BoxGeometry(2, 2, 2)));
    // BoxGeometry(2,2,2) -> 12 triangles, 24 position vertices.
    expect(result?.meshCount).toBe(1);
    expect(result?.materialCount).toBe(1);
    expect(result?.triangleCount).toBe(12);
    expect(result?.dimensions).toEqual([2, 2, 2]);
    expect(result?.largestAxis).toBe('x');
  });

  it('counts meshes across nested groups', () => {
    const root = new Group();
    const inner = new Group();
    inner.add(mesh(), mesh());
    root.add(inner, mesh());
    expect(describeScene(root)?.meshCount).toBe(3);
  });

  it('treats a material shared by several meshes as one material', () => {
    const shared = new MeshStandardMaterial({ name: 'Shell' });
    const root = new Group();
    root.add(mesh(new BoxGeometry(), shared), mesh(new SphereGeometry(1, 8, 8), shared));
    const result = describeScene(root);
    expect(result?.materialCount).toBe(1);
    expect(result?.meshCount).toBe(2);
  });

  it('counts every material on a multi-material mesh', () => {
    const root = new Group();
    root.add(
      mesh(
        new BoxGeometry(),
        [new MeshStandardMaterial({ name: 'A' }), new MeshStandardMaterial({ name: 'B' })],
      ),
    );
    const result = describeScene(root);
    expect(result?.materialCount).toBe(2);
    expect(result?.materials.map((m) => m.name)).toEqual(['A', 'B']);
  });

  it('reports dimensions of an off-centre model', () => {
    const root = new Group();
    const box = mesh(new BoxGeometry(2, 4, 6));
    box.position.set(10, 0, 0);
    root.add(box);
    const result = describeScene(root);
    expect(result?.dimensions).toEqual([2, 4, 6]);
    expect(result?.largestAxis).toBe('z');
  });

  it('collects object names and keeps unnamed objects out of the list', () => {
    const root = new Group();
    const named = mesh();
    named.name = '  Hull  ';
    const unnamed = mesh();
    root.add(named, unnamed);
    const result = describeScene(root);
    expect(result?.objectNames).toEqual(['Hull']);
    expect(result?.namedObjectCount).toBe(1);
    expect(result?.meshCount).toBe(2);
  });

  it('caps very long name lists but still reports the true count', () => {
    const root = new Group();
    for (let i = 0; i < MAX_INSPECTED_NAMES + 12; i += 1) {
      const child = new Object3D();
      child.name = `Node ${i}`;
      root.add(child);
    }
    const result = describeScene(root);
    expect(result?.objectNames).toHaveLength(MAX_INSPECTED_NAMES);
    expect(result?.namedObjectCount).toBe(MAX_INSPECTED_NAMES + 12);
  });

  it('exposes material type, colour and texture counts', () => {
    const material = new MeshStandardMaterial({ name: 'Glass', roughness: 0.25, metalness: 0.5 });
    material.color.set('#d6a85f');
    const root = new Group();
    root.add(mesh(new BoxGeometry(), material));
    const [entry] = describeScene(root)?.materials ?? [];
    expect(entry?.type).toBe('MeshStandardMaterial');
    expect(entry?.name).toBe('Glass');
    expect(entry?.color).toBe('#d6a85f');
    expect(entry?.roughness).toBe(0.25);
    expect(entry?.metalness).toBe(0.5);
    expect(entry?.textureCount).toBe(0);
  });

  it('names unnamed materials as null rather than inventing a label', () => {
    const root = new Group();
    root.add(mesh(new BoxGeometry(), new MeshBasicMaterial()));
    expect(describeScene(root)?.materials[0]?.name).toBeNull();
  });

  it('survives a mesh with no material and a mesh with no geometry', () => {
    const root = new Group();
    const noMaterial = new Mesh(new BoxGeometry());
    noMaterial.material = undefined as unknown as Mesh['material'];
    const noGeometry = new Mesh(undefined as unknown as BoxGeometry, new MeshBasicMaterial());
    root.add(noMaterial, noGeometry);
const result = describeScene(root);
    expect(result?.meshCount).toBe(2);
    // Only the geometry-less mesh carries a material, and it still counts.
    expect(result?.materialCount).toBe(1);
  });

  it('lists animation clips and falls back to a positional label', () => {
    const result = describeScene(new Group(), [clip('Walk'), clip('')]);
    // Unnamed clips keep the viewer's existing 1-based fallback label.
    expect(result?.animationNames).toEqual(['Walk', 'Clip 2']);
    expect(describeScene(mesh())?.animationNames).toEqual([]);
  });

  it('detects skinned meshes', () => {
    const root = new Group();
    const skinned = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
    root.add(skinned, mesh());
    const result = describeScene(root);
    expect(result?.skinnedMeshCount).toBe(1);
    expect(result?.meshCount).toBe(2);
  });

  it('detects morph targets when present', () => {
    const geometry = new BoxGeometry();
    geometry.morphAttributes.position = [new BufferAttribute(new Float32Array(72), 3)];
    const result = describeScene(mesh(geometry));
    expect(result?.hasMorphTargets).toBe(true);
    expect(describeScene(mesh())?.hasMorphTargets).toBe(false);
  });

  it('never throws on unusual structures', () => {
    const broken = {
      traverse: (cb: (child: unknown) => void) => {
        cb({ isMesh: true, name: undefined, geometry: null, material: undefined });
        cb(null);
        cb({ isMesh: false });
      },
    } as unknown as Object3D;
    expect(() => describeScene(broken)).not.toThrow();
    expect(describeScene(broken)?.meshCount).toBe(1);
  });

  it('rounds dimensions to two decimals for readable mono values', () => {
    const root = new Group();
    const box = mesh(new BoxGeometry(1.23456, 2.5, 3));
    root.add(box);
    expect(describeScene(root)?.dimensions).toEqual([1.23, 2.5, 3]);
  });

  it('produces plain serialisable data (safe for state + snapshots)', () => {
    const result = describeScene(mesh());
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe('describeScene geometry helpers', () => {
it('uses Box3 of the whole subtree', () => {
    const root = new Group();
    root.add(mesh(new BoxGeometry(2, 2, 2)));
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    expect(describeScene(root)?.dimensions).toEqual([size.x, size.y, size.z]);
  });
});


