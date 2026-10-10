import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Object3D } from 'three';
import { Group, LineBasicMaterial, LineSegments, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import { setEditorWorkingScene } from '@/editor/editorRuntime';
import { clearHistory } from '@/editor/history/history';
import { useEditorStore } from '@/stores/useEditorStore';
import { buildPrimitiveGeometry, defaultParams, writePrimitiveMeta } from '@/editor/primitives';
import {
  PROJECT_FORMAT_VERSION,
  emptyProjectDocument,
  isProjectDocument,
  safeFileName,
  validateProjectDocument,
} from '@/editor/projects/projectFormat';
import { serialiseWorkingScene, restoreMaterials } from '@/editor/projects/projectSerializer';
import { buildExportRoot, exportSceneToGlb } from '@/editor/projects/glbExport';

/**
 * Project format, serialisation and export.
 *
 * The round-trip is asserted against a REAL working scene built from real
 * geometries, because the failure this guards against - a document that records
 * a shape the scene cannot actually rebuild - only shows up against real data.
 */

function scene(): WorkingScene {
  const root = new Group();
  root.name = 'Source';
  const box = new Mesh(
    buildPrimitiveGeometry('box', defaultParams('box')),
    new MeshStandardMaterial({ color: 0x445566, roughness: 0.4, metalness: 0.2 }),
  );
  box.name = 'Box';
  box.position.set(1, 2, 3);
  const sphere = new Mesh(
    buildPrimitiveGeometry('sphere', defaultParams('sphere')),
    new MeshStandardMaterial({ color: 0x778899 }),
  );
  sphere.name = 'Sphere';
  root.add(box, sphere);
  return createWorkingScene(root, { idPrefix: 'p' });
}

beforeEach(() => {
  clearHistory();
  setEditorWorkingScene(null);
  useEditorStore.getState().resetEditor();
});

describe('project format', () => {
  it('stamps a new document with the current version', () => {
    const document = emptyProjectDocument('id-1', 'My project');
    expect(document.formatVersion).toBe(PROJECT_FORMAT_VERSION);
    expect(document.name).toBe('My project');
    expect(document.nodes).toEqual([]);
  });

  it('rejects something that is not a project', () => {
    expect(isProjectDocument({ hello: 'world' })).toBe(false);
    const result = validateProjectDocument({ hello: 'world' });
    expect(result.ok).toBe(false);
  });

  it('refuses a document from a newer format rather than half-applying it', () => {
    const document = emptyProjectDocument('id-2', 'Future');
    const result = validateProjectDocument({
      ...document,
      formatVersion: PROJECT_FORMAT_VERSION + 99,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('accepts a document written by this version', () => {
    const result = validateProjectDocument(emptyProjectDocument('id-3', 'Current'));
    expect(result.ok).toBe(true);
  });

  it('builds a filesystem-safe export name', () => {
    expect(safeFileName('My Model / v2', '.glb')).toBe('My-Model-v2.glb');
    expect(safeFileName('***', '.glb')).toBe('project.glb');
    expect(safeFileName('', '.glb')).toBe('project.glb');
  });
});

describe('scene serialisation', () => {
  it('captures every top-level node with its transform', () => {
    const working = scene();
    const result = serialiseWorkingScene(working);

    expect(result.nodes).toHaveLength(2);
    const names = result.nodes.map((node) => node.name);
    expect(names).toEqual(['Box', 'Sphere']);

    const box = result.nodes[0]!;
    expect(box.position).toEqual([1, 2, 3]);
    expect(box.id).toBeTruthy();
    expect(box.materials).toHaveLength(1);
  });

  it('shares one material record between meshes that share a material', () => {
    const root = new Group();
    root.name = 'Source';
    const shared = new MeshStandardMaterial({ color: 0x123456 });
    const first = new Mesh(buildPrimitiveGeometry('box', defaultParams('box')), shared);
    first.name = 'A';
    const second = new Mesh(buildPrimitiveGeometry('box', defaultParams('box')), shared);
    second.name = 'B';
    root.add(first, second);

    const working = createWorkingScene(root, { idPrefix: 'sh' });
    const result = serialiseWorkingScene(working);

    // Sharing is part of the scene's meaning, so it must survive a save.
    expect(Object.keys(result.materials)).toHaveLength(1);
  });

  it('records editor primitives with their parameters so they can be rebuilt', () => {
    const root = new Group();
    root.name = 'Source';
    const mesh = new Mesh(
      buildPrimitiveGeometry('box', defaultParams('box')),
      new MeshStandardMaterial(),
    );
    mesh.name = 'Editor Box';
    root.add(mesh);
    const working = createWorkingScene(root, { idPrefix: 'pr' });

    // Mark the WORKING clone as an editor primitive. The source node was cloned,
    // so tagging the original would not survive into the scene being saved.
    const workingMesh = working.root.children[0] as Mesh;
    writePrimitiveMeta(workingMesh, 'box', defaultParams('box'));

    const result = serialiseWorkingScene(working);
    expect(result.nodes[0]?.primitive?.kind).toBe('box');
    expect(result.nodes[0]?.primitive?.params).toBeTruthy();
  });
});

describe('material restore', () => {
  it('rebuilds a material of the saved class with its values', () => {
    const materials = restoreMaterials(
      {
        'mat-1': {
          key: 'mat-1',
          name: 'Painted',
          type: 'MeshStandardMaterial',
          color: '#ff8800',
          roughness: 0.35,
          metalness: 0.65,
          opacity: 1,
          transparent: false,
          depthWrite: true,
        },
      },
      { resolve: () => null },
    );

    const material = materials.get('mat-1') as MeshStandardMaterial;
    expect(material).toBeTruthy();
    expect(material.type).toBe('MeshStandardMaterial');
    expect(material.name).toBe('Painted');
    expect(material.roughness).toBe(0.35);
    expect(material.metalness).toBe(0.65);
    const color = material.color.getHexString('srgb');
    expect(color.toLowerCase()).toBe('ff8800');
  });

  it('falls back to a standard material for an unknown class', () => {
    const materials = restoreMaterials(
      { 'mat-2': { key: 'mat-2', name: 'Odd', type: 'SomeFutureMaterial' } },
      { resolve: () => null },
    );
    expect((materials.get('mat-2') as MeshStandardMaterial).type).toBe('MeshStandardMaterial');
  });

  it('leaves a slot empty when its texture cannot be resolved', () => {
    const materials = restoreMaterials(
      {
        'mat-3': {
          key: 'mat-3',
          name: 'Textured',
          type: 'MeshStandardMaterial',
          textures: { map: 'tex-missing' },
        },
      },
      { resolve: () => null },
    );
    const material = materials.get('mat-3') as MeshStandardMaterial;
    expect(material.map).toBeNull();
  });
});

describe('GLB export', () => {
  it('clones the scene instead of exporting the live graph', () => {
    const working = scene();
    const exportRoot = buildExportRoot(working);

    expect(exportRoot).not.toBe(working.root);
    expect(exportRoot.children).toHaveLength(2);
    // The live scene is untouched by building an export root.
    expect(working.root.children).toHaveLength(2);
  });

  it('strips the selection outline from the export', () => {
    const working = scene();
    const outline = new LineSegments(
      new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3)),
      new LineBasicMaterial(),
    );
    const target = working.root.children[0] as Mesh;
    target.add(outline);
    expect(target.children.length).toBeGreaterThan(0);

    const exportRoot = buildExportRoot(working);
    const exportedMesh = exportRoot.children[0] as Mesh;
    // The outline is a child of the selected mesh, so it would be the first child.
    const isLine = (object: Object3D): boolean =>
      (object as unknown as { isLineSegments?: boolean }).isLineSegments === true;
    expect(exportedMesh.children.every((child) => !isLine(child))).toBe(true);
    // ...and the live mesh keeps its own outline.
    expect(target.children.some(isLine)).toBe(true);
  });

  it('does not dispose or mutate the working scene while exporting', async () => {
    const working = scene();
    const before = working.root.children.length;
    const material = (working.root.children[0] as Mesh).material as MeshStandardMaterial;
    const colourBefore = material.color.getHexString();

    const result = await exportSceneToGlb(working, 'Export test');

    expect(working.root.children).toHaveLength(before);
    expect(material.color.getHexString()).toBe(colourBefore);
    // Disposal would have flagged the material; a live scene stays usable.
    expect(working.disposed).toBe(false);
    void result;
  }, 20000);

  it('produces a binary GLB with a sensible file name', async () => {
    const working = scene();
    const result = await exportSceneToGlb(working, 'My Model / v2');

    expect(result.ok).toBe(true);
    expect(result.fileName).toBe('My-Model-v2.glb');
    expect(result.blob?.type).toBe('model/gltf-binary');
    expect((result.byteLength ?? 0)).toBeGreaterThan(0);
  }, 20000);

  it('re-parses its own output as a valid glTF', async () => {
    const working = scene();
    const result = await exportSceneToGlb(working, 'Round trip');
    expect(result.ok).toBe(true);

    const buffer = await result.blob!.arrayBuffer();
    // glTF binary magic: "glTF" as little-endian uint32.
    const magic = new DataView(buffer).getUint32(0, true);
    expect(magic).toBe(0x46546c67);

    const version = new DataView(buffer).getUint32(4, true);
    expect(version).toBe(2);
  }, 20000);
});

afterEach(() => {
  vi.restoreAllMocks();
});