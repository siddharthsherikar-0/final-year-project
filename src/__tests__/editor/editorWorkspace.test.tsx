import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
} from 'three';
import type { SceneNode } from '@/editor/sceneTree';
import { SceneHierarchy } from '@/components/editor/SceneHierarchy';
import { TransformInspector } from '@/components/editor/TransformInspector';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import { buildSceneTree } from '@/editor/sceneTree';
import { setEditorWorkingScene } from '@/editor/editorRuntime';
import { useEditorStore } from '@/stores/useEditorStore';
import { useViewerStore } from '@/stores/useViewerStore';
import { readTransform } from '@/editor/transformMath';

/**
 * Editor workspace integration.
 *
 * These mount the real panels against a real working scene and assert that the
 * hierarchy, the selection store and the numeric inspector all agree. R3F and
 * the Canvas are covered by the Phase I regression suite and the browser
 * harness, so they are deliberately not re-implemented here.
 */

let working: WorkingScene;

/**
 * jsdom's matchMedia always reports "no match", which would make every layout
 * test run the mobile branch. This stubs it so both branches are testable.
 */
function stubDesktopViewport(isDesktop: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('1024px') ? isDesktop : !isDesktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

let restoreMatchMedia: (() => void) | null = null;

function buildScene(): WorkingScene {
  const shared = new MeshStandardMaterial();
  const source = new Scene();

  const group = new Group();
  group.name = 'Root';
  source.add(group);

  const box = new Mesh(new BoxGeometry(1, 2, 3), shared);
  box.name = 'Body';
  group.add(box);

  const ball = new Mesh(new SphereGeometry(1, 8, 6), shared);
  ball.name = 'Body';
  group.add(ball);

  const unnamed = new Mesh(new BoxGeometry(), shared);
  unnamed.name = '';
  group.add(unnamed);

  return createWorkingScene(source, { idPrefix: 'it' });
}

function nodeByLabel(label: string) {
  const flat = useEditorStore.getState().tree ?? [];
  const walk = (nodes: typeof flat): string | null => {
    for (const node of nodes) {
      if (node.label === label) return node.id;
      const found = walk(node.children);
      if (found) return found;
    }
    return null;
  };
  return walk(flat);
}

function nodeVisible(id: string): boolean | undefined {
  const walk = (nodes: SceneNode[]): boolean | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node.visible;
      const found = walk(node.children);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(useEditorStore.getState().tree ?? []);
}

beforeEach(() => {
  // Desktop by default; responsive tests opt into the mobile branch.
  restoreMatchMedia?.();
  restoreMatchMedia = stubDesktopViewport(true);
  working = buildScene();
  setEditorWorkingScene(working);
  useEditorStore.getState().resetEditor();
  useEditorStore.getState().setTree(buildSceneTree(working.root, working.registry));
useViewerStore.getState().resetStudioState();
  // Mirrors what ModelViewer does when it mounts the editor layout.
  useViewerStore.getState().setPanelOpen(true);
});

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  setEditorWorkingScene(null);
  working.dispose();
  useEditorStore.getState().resetEditor();
});

describe('scene hierarchy panel', () => {
  it('renders one row per registered node, nested by depth', () => {
    render(<SceneHierarchy />);

    expect(screen.getByTestId('hierarchy-list')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getAllByText('Body')).toHaveLength(2);
    // The unnamed mesh still gets a readable fallback label.
    expect(screen.getByText(/^Mesh \d+$/)).toBeInTheDocument();
  });

  it('marks the two objects that share a name', () => {
    render(<SceneHierarchy />);
    const rows = screen.getAllByText('Body');
    expect(rows).toHaveLength(2);
    expect(screen.getAllByTitle('Another object shares this name')).toHaveLength(2);
  });

  it('selects an object from the hierarchy', () => {
    render(<SceneHierarchy />);
    const id = nodeByLabel('Body');

    fireEvent.click(screen.getByTestId(`hierarchy-row-${id}`));

    expect(useEditorStore.getState().selectedIds).toEqual([id]);
  });

  it('adds to the selection on a modifier click', () => {
    render(<SceneHierarchy />);
    const first = nodeByLabel('Body');
    const second = useEditorStore
      .getState()
      .tree?.[0]?.children?.[1]?.id;

    fireEvent.click(screen.getByTestId(`hierarchy-row-${first}`));
    fireEvent.click(screen.getByTestId(`hierarchy-row-${second}`), { shiftKey: true });

    expect(useEditorStore.getState().selectedIds).toEqual([first, second]);
  });

  it('keeps the viewport selection in sync with the highlighted row', () => {
    render(<SceneHierarchy />);
    const id = nodeByLabel('Body') ?? '';
    const row = screen.getByTestId(`hierarchy-row-${id}`);

    // Selection made elsewhere (e.g. a viewport click) is reflected here.
    act(() => useEditorStore.getState().select(id));

    expect(row).toHaveAttribute('aria-pressed', 'true');
  });

it('toggles visibility on the live object and republishes the tree', () => {
    render(<SceneHierarchy />);
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    const row = screen.getByTestId(`hierarchy-row-${id}`).parentElement!;

    expect(object?.visible).toBe(true);
    fireEvent.click(within(row).getByRole('button', { name: /^Hide / }));

    expect(object?.visible).toBe(false);
    // Only that mesh changed: its parent group and its sibling stay visible.
    expect(object?.parent?.visible).toBe(true);
    expect(nodeVisible(useEditorStore.getState().tree?.[0]?.children?.[1]?.id ?? '')).toBe(true);
  });

  it('shows an empty state when the scene has no objects', () => {
    act(() => useEditorStore.getState().setTree([]));
    render(<SceneHierarchy />);
    expect(screen.getByTestId('hierarchy-empty')).toBeInTheDocument();
  });

  it('drops selection ids that no longer resolve', () => {
    const id = nodeByLabel('Body') ?? '';
    act(() => useEditorStore.getState().select(id));
    act(() => useEditorStore.getState().retainSelection([]));

    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});

describe('transform inspector', () => {
  it('shows an empty state with no selection', () => {
    render(<TransformInspector />);
    expect(screen.getByTestId('transform-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('transform-inspector')).toBeNull();
  });

  it('shows position, rotation and scale for the selected object', () => {
    const id = nodeByLabel('Body') ?? '';
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    expect(screen.getByTestId('transform-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('transform-position-X')).toHaveValue(0);
    expect(screen.getByTestId('transform-rotation-Y')).toHaveValue(0);
    expect(screen.getByTestId('transform-scale-Z')).toHaveValue(1);
  });

  it('writes a typed position onto the live object', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('transform-position-X'), {
      target: { value: '4.5' },
    });

    expect(object?.position.x).toBeCloseTo(4.5, 5);
    expect(screen.getByTestId('transform-position-X')).toHaveValue(4.5);
    expect(useEditorStore.getState().isModified).toBe(true);
  });

  it('writes rotation in degrees', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('transform-rotation-Y'), {
      target: { value: '90' },
    });

    expect(readTransform(object!).rotation[1]).toBeCloseTo(90, 4);
  });

  it('writes scale and refuses zero', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('transform-scale-X'), { target: { value: '3' } });
    expect(object?.scale.x).toBeCloseTo(3, 5);

    fireEvent.change(screen.getByTestId('transform-scale-Y'), { target: { value: '0' } });
    // The rejected value must not be applied; Y keeps its previous value.
    expect(object?.scale.y).toBeCloseTo(1, 5);
    expect(screen.getByTestId('transform-error')).toBeInTheDocument();
  });

  it('applies snapping to a typed value only when snapping is on', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    act(() => useEditorStore.getState().select(id));
    act(() => useEditorStore.getState().setSnaps({ translation: 0.5 }));
    act(() => useEditorStore.getState().setSnapEnabled(true));
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('transform-position-X'), { target: { value: '1.3' } });
    expect(object?.position.x).toBeCloseTo(1.5, 5);

    act(() => useEditorStore.getState().setSnapEnabled(false));
    fireEvent.change(screen.getByTestId('transform-position-X'), { target: { value: '1.3' } });
    expect(object?.position.x).toBeCloseTo(1.3, 5);
  });

  it('re-reads values after the gizmo bumps the transform epoch', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    // Simulates a completed gizmo drag writing straight to the object.
    object!.position.set(9, 9, 9);
    act(() => useEditorStore.getState().bumpTransformEpoch());

    expect(screen.getByTestId('transform-position-X')).toHaveValue(9);
  });

  it('transforms the object and not its parent', () => {
    const id = nodeByLabel('Body') ?? '';
    const object = working.resolve(id);
    const parent = object?.parent;
    act(() => useEditorStore.getState().select(id));
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('transform-position-Z'), { target: { value: '7' } });

    expect(object?.position.z).toBeCloseTo(7, 5);
    expect(parent?.position.toArray()).toEqual([0, 0, 0]);
  });
});

describe('material inspector', () => {
  /**
   * The build scene gives Body, Body and the unnamed mesh ONE shared material,
   * so any material edit made through the panel is a copy-on-write case: the
   * object under the cursor changes and the other users of the same material
   * instance must not.
   */
  function selectFirstBody(): string {
    const id = nodeByLabel('Body') ?? '';
    act(() => useEditorStore.getState().select(id));
    return id;
  }

  /** A minimal scene whose meshes all share one material instance. */
  function sharedWorkspace(): WorkingScene {
    const shared = new MeshStandardMaterial();
    shared.name = 'Shared';
    const source = new Scene();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), shared));
    source.add(new Mesh(new SphereGeometry(1, 8, 6), shared));
    return createWorkingScene(source, { idPrefix: 'lib' });
  }

  function materialOf(id: string) {
    return (working.resolve(id) as Mesh).material;
  }

  it('is hidden when nothing is selected', () => {
    render(<TransformInspector />);
    expect(screen.queryByTestId('material-section')).not.toBeInTheDocument();
  });

  it('reports material metadata for the selected mesh', () => {
    selectFirstBody();
    render(<TransformInspector />);

    expect(screen.getByTestId('material-section')).toBeInTheDocument();
    expect(screen.getByTestId('material-meta')).toBeInTheDocument();
    expect(screen.getByText('MeshStandardMaterial')).toBeInTheDocument();
    // Cloned from the source by the working scene, so it reports as such.
    expect(within(screen.getByTestId('material-meta')).getByText('Editor-owned')).toBeInTheDocument();
  });

  it('names the slot count for a multi-material mesh', () => {
    const red = new MeshStandardMaterial();
    const blue = new MeshStandardMaterial();
    const source = new Scene();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [red, blue]);
    mesh.name = 'Multi';
    source.add(mesh);
    const multiWorking = createWorkingScene(source, { idPrefix: 'meta' });
    setEditorWorkingScene(multiWorking);
    // `mesh` is the SOURCE object; the working scene holds a clone, so the id
    // must come from the working scene or nothing resolves.
    const workingMesh = multiWorking.root.children[0] as Mesh;
    act(() => useEditorStore.getState().select(multiWorking.registry.idOf(workingMesh) ?? ''));

    render(<TransformInspector />);

    expect(within(screen.getByTestId('material-meta')).getByText('1 of 2')).toBeInTheDocument();
    setEditorWorkingScene(working);
    multiWorking.dispose();
  });

  it('writes a committed hex colour to the real material', () => {
    const id = selectFirstBody();
    const before = materialOf(id);
    render(<TransformInspector />);

    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#ff8800' } });
    fireEvent.blur(field);

    expect(useEditorStore.getState().notice).toBe('Base colour updated');
    // Copy-on-write installed a NEW material on this mesh.
    const after = materialOf(id);
    expect(after).not.toBe(before);
    expect((after as MeshStandardMaterial).color.getHexString()).toBe('ff8800');
  });

  it('rejects an invalid hex without touching the material', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: 'zzz' } });
    fireEvent.blur(field);

    expect(screen.getByRole('alert')).toHaveTextContent(/hex/i);
    expect(materialOf(id)).toBeDefined();
    expect(useEditorStore.getState().materialEpoch).toBe(0);
  });

  it('does not change the other objects sharing the material', () => {
    const first = selectFirstBody();
    // A different mesh, same material instance.
    const second = (working.registry.ids()
      .map((id) => working.resolve(id))
      .find((object) => object?.name === 'Body' && working.registry.idOf(object!) !== first) ?? null) as
      | Mesh
      | null;
    const sharedBefore = second ? (second.material as MeshStandardMaterial).color.getHexString() : null;
    render(<TransformInspector />);

    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#00ff00' } });
    fireEvent.blur(field);

    if (second) {
      expect((second.material as MeshStandardMaterial).color.getHexString()).toBe(sharedBefore);
    }
  });

  it('edits roughness and metalness through the sliders', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('material-roughness-slider'), { target: { value: '0.9' } });
    fireEvent.change(screen.getByTestId('material-metalness-slider'), { target: { value: '0.1' } });

    const material = materialOf(id) as MeshStandardMaterial;
    expect(material.roughness).toBeCloseTo(0.9, 5);
    expect(material.metalness).toBeCloseTo(0.1, 5);
  });

  it('turns transparency on when the opacity slider moves below 1', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    fireEvent.change(screen.getByTestId('material-opacity-slider'), { target: { value: '0.5' } });

    const material = materialOf(id) as MeshStandardMaterial;
    expect(material.opacity).toBeCloseTo(0.5, 5);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    // The panel reflects the new state on the next render.
    expect(screen.getByTestId('material-transparent')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles transparency from the switch', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    fireEvent.click(screen.getByTestId('material-transparent'));

    const material = materialOf(id) as MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
  });

  it('writes emissive colour and intensity', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    const field = screen.getByTestId('material-emissive-hex');
    fireEvent.change(field, { target: { value: '#00ffff' } });
    fireEvent.blur(field);
    fireEvent.change(screen.getByTestId('material-emissive-intensity-value'), {
      target: { value: '3' },
    });
    fireEvent.blur(screen.getByTestId('material-emissive-intensity-value'));

    const material = materialOf(id) as MeshStandardMaterial;
    expect(material.emissive.getHexString()).toBe('00ffff');
    expect(material.emissiveIntensity).toBeCloseTo(3, 5);
  });

  it('offers the shared-edit switch only for a genuinely shared material', () => {
    selectFirstBody();
    render(<TransformInspector />);

    // Three meshes share this material instance in the test scene.
    expect(screen.getByTestId('material-shared-toggle')).toBeInTheDocument();
    expect(screen.getByText(/other slots/)).toBeInTheDocument();
  });

  it('edits the shared material in place when the switch is on', () => {
    const first = selectFirstBody();
    const neighbour = working.registry.ids()
      .map((id) => working.resolve(id))
      .find((object) => object?.name === 'Body' && working.registry.idOf(object!) !== first) as Mesh;
    const sharedBefore = (neighbour.material as MeshStandardMaterial).color.getHexString();

    act(() => useEditorStore.getState().setSharedMaterialEditing(true));
    render(<TransformInspector />);

    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#123456' } });
    fireEvent.blur(field);

    // Deliberate, explicit sharing: the neighbour changed too.
    expect((neighbour.material as MeshStandardMaterial).color.getHexString()).not.toBe(sharedBefore);
  });

  it('duplicates a material and keeps the neighbour on the original', () => {
    const first = selectFirstBody();
    const neighbour = working.registry.ids()
      .map((id) => working.resolve(id))
      .find((object) => object?.name === 'Body' && working.registry.idOf(object!) !== first) as Mesh;
    const sharedBefore = neighbour.material;

    render(<TransformInspector />);
    fireEvent.click(screen.getByTestId('material-duplicate'));

    expect(materialOf(first)).not.toBe(sharedBefore);
    expect(neighbour.material).toBe(sharedBefore);
    expect(useEditorStore.getState().notice).toMatch(/^Duplicated as /);
  });

  it('resets a material to its captured baseline', () => {
    const first = selectFirstBody();
    const original = (materialOf(first) as MeshStandardMaterial).color.getHexString();

    render(<TransformInspector />);
    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#ff0000' } });
    fireEvent.blur(field);
    expect((materialOf(first) as MeshStandardMaterial).color.getHexString()).toBe('ff0000');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect((materialOf(first) as MeshStandardMaterial).color.getHexString()).toBe(original);
  });

  it('lists all six texture slots with their populated state', () => {
    selectFirstBody();
    render(<TransformInspector />);

    expect(screen.getByTestId('material-textures')).toBeInTheDocument();
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
      expect(screen.getByTestId(`texture-row-${key}`)).toBeInTheDocument();
      expect(screen.getByTestId(`texture-state-${key}`)).toHaveTextContent('Empty');
      expect(screen.getByTestId(`texture-input-${key}`)).toHaveAttribute(
        'accept',
        expect.stringContaining('image/png'),
      );
    }
  });

  it('offers a file picker limited to supported image formats', () => {
    selectFirstBody();
    render(<TransformInspector />);

    const input = screen.getByTestId('texture-input-map') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toContain('.png');
    expect(input.accept).toContain('.webp');
    expect(input.accept).not.toContain('.gltf');
  });

  it('hides roughness and metalness for a material class without them', () => {
    const basicSource = new MeshBasicMaterial({ color: 0x00ff00 });
    basicSource.name = 'Unlit';
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), basicSource);
    mesh.name = 'Unlit';
    const scene = new Scene();
    scene.add(mesh);
    const basicWorking = createWorkingScene(scene, { idPrefix: 'unlit' });
    setEditorWorkingScene(basicWorking);
    useEditorStore.getState().setTree(buildSceneTree(basicWorking.root, basicWorking.registry));
    // mesh is the SOURCE object; the working scene holds a clone, so the id
    // must be resolved from the working scene or nothing resolves.
    const workingMesh = basicWorking.root.children[0] as Mesh;
    act(() => useEditorStore.getState().select(basicWorking.registry.idOf(workingMesh) ?? ''));

    render(<TransformInspector />);

    expect(screen.getByTestId('material-section')).toBeInTheDocument();
    // Base colour and opacity still work...
    expect(screen.getByTestId('material-color-hex')).toBeInTheDocument();
    expect(screen.getByTestId('material-opacity-slider')).toBeInTheDocument();
    // ...but PBR scalars the class ignores are not offered at all.
    expect(screen.queryByTestId('material-roughness-slider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-metalness-slider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-emissive-hex')).not.toBeInTheDocument();

    setEditorWorkingScene(working);
    basicWorking.dispose();
  });

  it('shows a slot picker for a multi-material mesh and edits slots independently', () => {
    const red = new MeshStandardMaterial({ color: 0xff0000 });
    const blue = new MeshStandardMaterial({ color: 0x0000ff });
    const source = new Scene();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [red, blue]);
    mesh.name = 'Multi';
    source.add(mesh);
    const multiWorking = createWorkingScene(source, { idPrefix: 'multi' });
    setEditorWorkingScene(multiWorking);
    useEditorStore.getState().setTree(buildSceneTree(multiWorking.root, multiWorking.registry));
    // Same caveat: the id has to come from the working scene, not the source.
    const workingMesh = multiWorking.root.children[0] as Mesh;
    const id = multiWorking.registry.idOf(workingMesh) ?? '';
    act(() => useEditorStore.getState().select(id));

    render(<TransformInspector />);

    expect(screen.getByTestId('material-slots')).toBeInTheDocument();
    expect(screen.getByTestId('material-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('material-slot-1')).toBeInTheDocument();

    // Slot 0 is active; its colour drives the field.
    expect(screen.getByTestId('material-color-hex')).toHaveValue('#ff0000');

    fireEvent.click(screen.getByTestId('material-slot-1'));
    expect(screen.getByTestId('material-color-hex')).toHaveValue('#0000ff');

    // Editing slot 1 must leave slot 0 alone.
    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#00ff00' } });
    fireEvent.blur(field);

    const slots = (multiWorking.resolve(id) as Mesh).material as MeshStandardMaterial[];
    expect(slots).toHaveLength(2);
    expect(slots[1]?.color.getHexString()).toBe('00ff00');
    expect(slots[0]?.color.getHexString()).toBe('ff0000');

    setEditorWorkingScene(working);
    multiWorking.dispose();
  });

  it('offers create and duplicate even when the scene has no named materials', () => {
    selectFirstBody();
    render(<TransformInspector />);

    expect(screen.getByTestId('material-new')).toBeInTheDocument();
    expect(screen.getByTestId('material-duplicate')).toBeInTheDocument();
    // The assign picker stays hidden while nothing in the scene is named:
    // offering a list of empty entries would be a control that cannot work.
    expect(screen.queryByTestId('material-assign')).not.toBeInTheDocument();
  });

  it('creates a new material and assigns it to the active slot only', () => {
    const first = selectFirstBody();
    const neighbour = working.registry.ids()
      .map((id) => working.resolve(id))
      .find((object) => object?.name === 'Body' && working.registry.idOf(object!) !== first) as Mesh;
    const neighbourMaterial = neighbour.material;

    render(<TransformInspector />);
    fireEvent.click(screen.getByTestId('material-new'));

    // One slot changed; the neighbour kept the material it already had.
    expect(materialOf(first)).not.toBe(neighbourMaterial);
    expect(neighbour.material).toBe(neighbourMaterial);
    expect(useEditorStore.getState().notice).toMatch(/^Created Material/);
  });

  it('lists each distinct material once in the assign picker', () => {
    const local = sharedWorkspace();
    setEditorWorkingScene(local);
    const id =
      local.registry.ids().find((entry) => (local.resolve(entry) as Mesh)?.isMesh === true) ?? '';
    act(() => useEditorStore.getState().select(id));

    render(<TransformInspector />);

    const options = within(screen.getByTestId('material-assign')).getAllByRole('option');
    // A placeholder plus the shared source material exactly once, despite three
    // meshes using it.
    expect(options).toHaveLength(2);
    setEditorWorkingScene(working);
    local.dispose();
  });

  it('renames the material from the library field', () => {
    const first = selectFirstBody();
    (materialOf(first) as MeshStandardMaterial).name = 'Before';

    render(<TransformInspector />);
    const field = screen.getByTestId('material-rename');
    fireEvent.change(field, { target: { value: 'After' } });
    fireEvent.blur(field);

    expect((materialOf(first) as MeshStandardMaterial).name).toBe('After');
  });

  it('rejects an empty material name', () => {
    const first = selectFirstBody();
    (materialOf(first) as MeshStandardMaterial).name = 'Keep';

    render(<TransformInspector />);
    const field = screen.getByTestId('material-rename');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);

    expect((materialOf(first) as MeshStandardMaterial).name).toBe('Keep');
    expect(useEditorStore.getState().notice).toMatch(/cannot be empty/i);
  });

  it('bumps the material epoch on a write so the panel never shows a stale value', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    expect(useEditorStore.getState().materialEpoch).toBe(0);
    const field = screen.getByTestId('material-color-hex');
    fireEvent.change(field, { target: { value: '#abcdef' } });
    fireEvent.blur(field);

    expect(useEditorStore.getState().materialEpoch).toBe(1);
    expect(useEditorStore.getState().isModified).toBe(true);
    expect(screen.getByTestId('material-color-hex')).toHaveValue('#abcdef');
    expect(materialOf(id)).toBeDefined();
  });

  it('re-reads values written directly to the live material', () => {
    const id = selectFirstBody();
    render(<TransformInspector />);

    // Simulates a change made outside React, as a shared-edit write would be.
    (materialOf(id) as MeshStandardMaterial).color.setStyle('#00aaff');
    act(() => useEditorStore.getState().bumpMaterialEpoch());

    expect(screen.getByTestId('material-color-hex')).toHaveValue('#00aaff');
  });
});

describe('editor toolbar', () => {
  it('switches the transform mode', () => {
    render(<EditorToolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }));
    expect(useEditorStore.getState().transformMode).toBe('rotate');

    fireEvent.click(screen.getByRole('button', { name: 'Scale' }));
    expect(useEditorStore.getState().transformMode).toBe('scale');
  });

  it('switches between local and world space', () => {
    render(<EditorToolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Local' }));
    expect(useEditorStore.getState().transformSpace).toBe('local');
    expect(screen.getByRole('button', { name: 'Local' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reveals snap increments only when snapping is enabled', () => {
    render(<EditorToolbar />);
    expect(screen.queryByTestId('snap-translation')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Snap' }));

    expect(screen.getByTestId('snap-translation')).toBeInTheDocument();
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it('edits a snap increment', () => {
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Snap' }));

    fireEvent.change(screen.getByTestId('snap-rotation'), { target: { value: '30' } });
    expect(useEditorStore.getState().rotationSnap).toBe(30);
  });

it('ships real undo and redo controls that are disabled when there is no history', () => {
    render(<EditorToolbar />);
    // Stage 9E brings the command history, so these controls are now real. They
    // must still start DISABLED rather than pretending to be usable, which is
    // exactly what the Stage 9B version of this test used to assert by their
    // absence.
    const undo = screen.getByRole('button', { name: /undo/i });
    const redo = screen.getByRole('button', { name: /redo/i });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    expect(undo).toHaveAttribute('title', 'Nothing to undo');
    expect(redo).toHaveAttribute('title', 'Nothing to redo');
  });
});

describe('editor status bar', () => {
  it('reports the empty selection state', () => {
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-selection')).toHaveTextContent('No selection');
  });

  it('reports the selected object and a multi-selection count', () => {
    render(<EditorStatusBar />);
    const children = useEditorStore.getState().tree?.[0]?.children ?? [];
    const first = children[0]?.id ?? '';
    const second = children[1]?.id ?? '';

    act(() => useEditorStore.getState().setSelection([first, second]));
    expect(screen.getByTestId('status-selection')).toHaveTextContent('Body +1 more');

    act(() => useEditorStore.getState().setSelection([first]));
    expect(screen.getByTestId('status-selection')).toHaveTextContent('Body');
    expect(screen.getByTestId('status-selection').textContent).not.toContain('+');
  });

  it('surfaces the modified indicator only after an edit', () => {
    render(<EditorStatusBar />);
    expect(screen.queryByTestId('status-modified')).toBeNull();

    act(() => useEditorStore.getState().setModified(true));
    expect(screen.getByTestId('status-modified')).toBeInTheDocument();
  });

  it('shows the active tool', () => {
    render(<EditorStatusBar />);
    act(() => useEditorStore.getState().setTransformMode('rotate'));
    expect(screen.getByTestId('editor-status')).toHaveTextContent('rotate');
  });
});

describe('editor workspace shell', () => {
  it('renders the toolbar, hierarchy, viewport, inspector and status regions', () => {
    render(
      <EditorWorkspace
        toolbar={<div data-testid="slot-toolbar" />}
        hierarchy={<div data-testid="slot-hierarchy" />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

    for (const slot of ['toolbar', 'hierarchy', 'viewport', 'inspector', 'status']) {
      expect(screen.getByTestId(`slot-${slot}`)).toBeInTheDocument();
    }
  });

it('mounts no canvas of its own', () => {
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<SceneHierarchy />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<TransformInspector />}
        status={<EditorStatusBar />}
      />,
    );

    expect(document.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('collapses and restores the hierarchy column', () => {
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<div data-testid="slot-hierarchy" />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

    expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
    act(() => useEditorStore.getState().toggleHierarchy());
    expect(screen.queryByTestId('slot-hierarchy')).toBeNull();
    // The viewport must survive with both columns collapsed.
    expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();

    act(() => useEditorStore.getState().toggleHierarchy());
    expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
  });

  it('collapses and restores the inspector column', () => {
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<div data-testid="slot-hierarchy" />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

    expect(screen.getByTestId('slot-inspector')).toBeInTheDocument();
    act(() => useViewerStore.getState().setPanelOpen(false));
    expect(screen.queryByTestId('slot-inspector')).toBeNull();
    expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
  });

  it('drives both columns from the toolbar toggles', () => {
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<div data-testid="slot-hierarchy" />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Scene' }));
    expect(screen.queryByTestId('slot-hierarchy')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    expect(screen.queryByTestId('slot-inspector')).toBeNull();

    // Re-opening restores both, so no control is a dead end.
    fireEvent.click(screen.getByRole('button', { name: 'Scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
    expect(screen.getByTestId('slot-inspector')).toBeInTheDocument();
  });

  it('collapses the hierarchy from the panel chevron', () => {
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<SceneHierarchy />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse scene hierarchy' }));

    expect(screen.queryByRole('complementary', { name: /scene hierarchy/i })).toBeNull();
  });
});




describe('editor workspace responsive panel strategy', () => {
  const renderShell = () =>
    render(
      <EditorWorkspace
        toolbar={<EditorToolbar />}
        hierarchy={<div data-testid="slot-hierarchy" />}
        viewport={<div data-testid="slot-viewport" />}
        inspector={<div data-testid="slot-inspector" />}
        status={<div data-testid="slot-status" />}
      />,
    );

  it('shows both panels side by side on desktop', () => {
    renderShell();
    expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
    expect(screen.getByTestId('slot-inspector')).toBeInTheDocument();
  });

  it('keeps the viewport mounted in every layout', () => {
    renderShell();
    expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
    expect(screen.getByTestId('slot-status')).toBeInTheDocument();
  });

  describe('below the lg breakpoint', () => {
    beforeEach(() => {
      restoreMatchMedia?.();
      restoreMatchMedia = stubDesktopViewport(false);
    });

    it('shows only the hierarchy when the inspector is closed', () => {
      act(() => useViewerStore.getState().setPanelOpen(false));
      renderShell();

      expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-inspector')).toBeNull();
      expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
    });

    it('swaps the hierarchy for the inspector rather than stacking both', () => {
      act(() => useViewerStore.getState().setPanelOpen(true));
      renderShell();

      // Two panels stacked with the viewport left under a third of a phone
      // screen was the reported layout defect.
      expect(screen.queryByTestId('slot-hierarchy')).toBeNull();
      expect(screen.getByTestId('slot-inspector')).toBeInTheDocument();
      expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
    });

    it('opens the inspector from the toolbar toggle', () => {
      act(() => useViewerStore.getState().setPanelOpen(false));
      renderShell();

      fireEvent.click(screen.getByRole('button', { name: 'Inspector' }));

      expect(screen.getByTestId('slot-inspector')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-hierarchy')).toBeNull();
      expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
    });

    it('restores the hierarchy when the inspector is closed again', () => {
      act(() => useViewerStore.getState().setPanelOpen(true));
      renderShell();
      expect(screen.queryByTestId('slot-hierarchy')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Inspector' }));

      expect(screen.getByTestId('slot-hierarchy')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-inspector')).toBeNull();
    });

    it('hides both panels when both toggles are off but keeps the viewport', () => {
      act(() => useViewerStore.getState().setPanelOpen(false));
      act(() => useEditorStore.getState().toggleHierarchy());
      renderShell();

      expect(screen.queryByTestId('slot-hierarchy')).toBeNull();
      expect(screen.queryByTestId('slot-inspector')).toBeNull();
      expect(screen.getByTestId('slot-viewport')).toBeInTheDocument();
      expect(screen.getByTestId('slot-status')).toBeInTheDocument();
    });

    it('never renders a second canvas in the compact layout', () => {
      renderShell();
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
    });
  });
});

describe('editor toolbar responsive controls', () => {
  it('exposes every tool with an accessible name at any width', () => {
    render(<EditorToolbar />);
    for (const label of ['Scene', 'Inspector', 'Move', 'Rotate', 'Scale', 'World', 'Local', 'Snap']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('keeps the transform tools reachable after switching modes', () => {
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Scale' }));
    expect(screen.getByRole('button', { name: 'Scale' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
  });
});
