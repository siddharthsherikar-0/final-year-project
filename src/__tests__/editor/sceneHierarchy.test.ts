import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, SphereGeometry } from 'three';
import { ObjectRegistry } from '@/editor/objectRegistry';
import { createWorkingScene } from '@/editor/workingScene';
import { buildSceneTree, findSceneNode, flattenSceneNodes } from '@/editor/sceneTree';
import { findSelectableAncestor, isSelectableObject } from '@/editor/picking';

function buildAsset() {
  const shared = new MeshStandardMaterial();
  const source = new Scene();
  source.name = 'Asset';

  const rootGroup = new Group();
  rootGroup.name = 'RootGroup';
  source.add(rootGroup);

  const a = new Mesh(new BoxGeometry(), shared);
  a.name = 'Cube.001';
  rootGroup.add(a);

  // Deliberately a DUPLICATE name: identity must not depend on names.
  const b = new Mesh(new SphereGeometry(1, 8, 6), shared);
  b.name = 'Cube.001';
  rootGroup.add(b);

  const unnamed = new Mesh(new BoxGeometry(), shared);
  unnamed.name = '';
  rootGroup.add(unnamed);

  const nested = new Group();
  nested.name = 'Nested';
  const inner = new Mesh(new BoxGeometry(), shared);
  inner.name = 'Inner';
  nested.add(inner);
  rootGroup.add(nested);

  return { source, rootGroup, a, b, unnamed, nested, inner, shared };
}

function nodeByLabel(nodes: ReturnType<typeof buildSceneTree>, label: string) {
  return flattenSceneNodes(nodes).find((node) => node.label === label) ?? null;
}

describe('ObjectRegistry', () => {
  it('assigns stable, prefixed ids', () => {
    const registry = new ObjectRegistry('ws');
    const mesh = new Mesh();

    const first = registry.register(mesh);
    const second = registry.register(mesh);

    expect(first).toBe(second);
    expect(first.startsWith('ws-')).toBe(true);
    expect(registry.resolve(first)).toBe(mesh);
  });

  it('returns null for unknown, empty and cleared ids', () => {
    const registry = new ObjectRegistry('ws');
    registry.register(new Mesh());

    expect(registry.resolve('missing')).toBeNull();
    expect(registry.resolve(null)).toBeNull();
    expect(registry.resolve(undefined)).toBeNull();
    expect(registry.resolve('')).toBeNull();

    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.resolve('ws-1')).toBeNull();
  });

  it('reports whether an id is known', () => {
    const registry = new ObjectRegistry('ws');
    const id = registry.register(new Mesh());
    expect(registry.has(id)).toBe(true);
    expect(registry.has('ws-99')).toBe(false);
  });
});

describe('scene hierarchy', () => {
  it('mirrors the real scene graph, including nesting depth', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('RootGroup');
    // RootGroup + 4 direct children (a, b, unnamed, Nested)
    expect(tree[0]?.children).toHaveLength(4);
    expect(tree[0]?.children[3]?.label).toBe('Nested');
    expect(tree[0]?.children[3]?.children).toHaveLength(1);
    expect(tree[0]?.children[3]?.children[0]?.label).toBe('Inner');

    working.dispose();
  });

  it('gives every node a distinct id, including duplicates by name', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const flat = flattenSceneNodes(buildSceneTree(working.root, working.registry));

    const ids = flat.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);

    const duplicates = flat.filter((node) => node.name === 'Cube.001');
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0]?.id).not.toBe(duplicates[1]?.id);
    expect(duplicates.every((node) => node.duplicateName)).toBe(true);

    working.dispose();
  });

  it('labels unnamed objects instead of showing a blank row', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);

    const blank = tree[0]?.children.find((node) => node.name === '');
    expect(blank).toBeDefined();
    expect(blank?.label).toMatch(/^Mesh \d+$/);
    expect(blank?.label.length).toBeGreaterThan(0);

    working.dispose();
  });

  it('reports kind, visibility and triangle counts', () => {
    const { source, a, b, rootGroup } = buildAsset();
    b.visible = false;
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);

    expect(tree[0]?.kind).toBe('group');
    expect(tree[0]?.visible).toBe(true);
    expect(tree[0]?.triangleCount).toBeNull();

    const cubeNode = tree[0]?.children.find((node) => node.name === 'Cube.001');
    const hiddenNode = tree[0]?.children.find((node) => node.visible === false);
    expect(cubeNode?.kind).toBe('mesh');
    expect(cubeNode?.triangleCount).toBe(12);
    expect(hiddenNode?.visible).toBe(false);

    // The source tree's own visibility was not altered by reading it.
    expect(a.visible).toBe(true);
    expect(rootGroup.visible).toBe(true);

    working.dispose();
  });

  it('finds and flattens nodes by id', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);
    const innerId = nodeByLabel(tree, 'Inner')?.id ?? '';

    expect(findSceneNode(tree, innerId)?.label).toBe('Inner');
    expect(findSceneNode(tree, 'ws-does-not-exist')).toBeNull();
    // RootGroup + Cube.001 + Cube.001 + unnamed + Nested + Inner
    expect(flattenSceneNodes(tree).length).toBe(6);

    working.dispose();
  });

  it('prunes ids for objects that left the working scene', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);
    const cubeId = tree[0]?.children[0]?.id ?? '';
    const cube = working.resolve(cubeId);

    expect(cube).not.toBeNull();
    // Remove from the WORKING tree; the cached source must be unaffected.
    cube?.removeFromParent();
    const dropped = working.registry.prune(working.root);

    expect(dropped).toContain(cubeId);
    expect(working.resolve(cubeId)).toBeNull();
    working.dispose();
  });

  it('resolves every id back to the object it describes', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });

    for (const node of flattenSceneNodes(buildSceneTree(working.root, working.registry))) {
      expect(working.resolve(node.id)?.name).toBe(node.name);
    }

    working.dispose();
  });

  it('registers the cloned objects, never the cached source objects', () => {
    const { source, inner } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });

    // The cached source object is a different instance from the working one.
    expect(working.registry.idOf(inner)).toBeNull();
    const workingInner = working.resolve(nodeByLabel(buildSceneTree(working.root, working.registry), 'Inner')?.id ?? '');
    expect(workingInner).not.toBe(inner);
    expect(workingInner?.name).toBe('Inner');

    working.dispose();
  });
});

describe('viewport picking', () => {
  it('treats only meshes as selectable', () => {
    expect(isSelectableObject(new Mesh())).toBe(true);
    expect(isSelectableObject(new Group())).toBe(false);
    expect(isSelectableObject(null)).toBe(false);
  });

  it('selects the nearest mesh ancestor of a raycast hit', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const tree = buildSceneTree(working.root, working.registry);
    const innerId = nodeByLabel(tree, 'Inner')?.id ?? '';

    // A deep hit resolves upward to its own mesh, never to the parent group.
    const group = working.root.children[0] as Group;
    const nested = group.children.find((child) => child.name === 'Nested') as Group;
    const hit = nested.children[0] as Mesh;

    expect(findSelectableAncestor(hit, working.registry)).toBe(hit);
    expect(working.registry.idOf(hit)).toBe(innerId);
    working.dispose();
  });

  it('returns null for a hit outside the working scene', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });
    const foreign = new Mesh();

    expect(findSelectableAncestor(foreign, working.registry)).toBeNull();
    expect(findSelectableAncestor(null, working.registry)).toBeNull();
    working.dispose();
  });

  it('does not select the working root when the scene is empty at that point', () => {
    const { source } = buildAsset();
    const working = createWorkingScene(source, { idPrefix: 'ws' });

    expect(findSelectableAncestor(working.root, working.registry)).toBeNull();
    working.dispose();
  });
});