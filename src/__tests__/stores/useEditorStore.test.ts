import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/stores/useEditorStore';
import type { SceneNode } from '@/editor/sceneTree';

function node(id: string, label: string, extra: Partial<SceneNode> = {}): SceneNode {
  return {
    id,
    name: label,
    label,
    kind: 'mesh',
    visible: true,
    triangleCount: 12,
    duplicateName: false,
    children: [],
    ...extra,
  };
}

function store() {
  return useEditorStore.getState();
}

describe('useEditorStore - selection', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it('starts with an empty selection', () => {
    expect(store().selectedIds).toEqual([]);
    expect(store().tree).toBeNull();
  });

  it('selects a single object, replacing any previous selection', () => {
    store().select('a');
    expect(store().selectedIds).toEqual(['a']);

    store().select('b');
    expect(store().selectedIds).toEqual(['b']);
  });

  it('adds to the selection when additive', () => {
    store().select('a');
    store().select('b', true);
    store().select('c', true);

    expect(store().selectedIds).toEqual(['a', 'b', 'c']);
  });

  it('removes an already selected object when clicked additively', () => {
    store().setSelection(['a', 'b', 'c']);
    store().select('b', true);

    expect(store().selectedIds).toEqual(['a', 'c']);
  });

  it('toggles a single object', () => {
    store().toggleSelection('a');
    expect(store().selectedIds).toEqual(['a']);
    store().toggleSelection('a');
    expect(store().selectedIds).toEqual([]);
  });

  it('deduplicates a manually set selection', () => {
    store().setSelection(['a', 'a', 'b']);
    expect(store().selectedIds).toEqual(['a', 'b']);
  });

  it('ignores an empty id', () => {
    store().select('a');
    store().select('');
    expect(store().selectedIds).toEqual(['a']);
  });

  it('clears the selection and the hover', () => {
    store().select('a');
    store().setHovered('a');
    store().clearSelection();

    expect(store().selectedIds).toEqual([]);
    expect(store().hoveredId).toBeNull();
  });
});

describe('useEditorStore - stale selection', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it('drops ids that no longer resolve', () => {
    store().setSelection(['a', 'b', 'c']);
    store().retainSelection(['b', 'c']);

    expect(store().selectedIds).toEqual(['b', 'c']);
  });

  it('clears the selection when the model switch keeps nothing alive', () => {
    store().setSelection(['a', 'b']);
    store().retainSelection([]);

    expect(store().selectedIds).toEqual([]);
  });

  it('does not churn state when every id is still live', () => {
    store().setSelection(['a']);
    const before = store().selectedIds;
    store().retainSelection(['a', 'b']);
    expect(store().selectedIds).toBe(before);
  });
});

describe('useEditorStore - tools', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it('exposes the three transform modes', () => {
    for (const mode of ['translate', 'rotate', 'scale'] as const) {
      store().setTransformMode(mode);
      expect(store().transformMode).toBe(mode);
    }
  });

  it('switches between local and world space', () => {
    expect(store().transformSpace).toBe('world');
    store().setTransformSpace('local');
    expect(store().transformSpace).toBe('local');
  });

  it('toggles snapping and stores increments', () => {
    expect(store().snapEnabled).toBe(false);
    store().setSnapEnabled(true);
    store().setSnaps({ translation: 0.5, rotation: 45, scale: 0.25 });

    expect(store().snapEnabled).toBe(true);
    expect(store().translationSnap).toBe(0.5);
    expect(store().rotationSnap).toBe(45);
    expect(store().scaleSnap).toBe(0.25);
  });

  it('only changes the snaps it is given', () => {
    // Snap increments are a tool preference, so they survive a model switch.
    store().setSnaps({ scale: 0.25 });
    store().setSnaps({ translation: 1 });
    store().setSnaps({ rotation: 30 });

    expect(store().translationSnap).toBe(1);
    expect(store().rotationSnap).toBe(30);
    expect(store().scaleSnap).toBe(0.25);
  });
});

describe('useEditorStore - material editing state', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it('defaults to editing only the selected object', () => {
    // Copy-on-write is the safe default: a material shared by several objects
    // must not be restyled by accident.
    expect(store().sharedMaterialEditing).toBe(false);
  });

  it('can opt into editing a shared material', () => {
    store().setSharedMaterialEditing(true);
    expect(store().sharedMaterialEditing).toBe(true);
  });

  it('resets the active material slot when the selection changes', () => {
    store().setSelection(['a']);
    store().setActiveMaterialSlot(3);
    expect(store().activeMaterialSlot).toBe(3);

    // A slot index is only meaningful for one mesh; carrying it across would
    // point the panel at the wrong material.
    store().setSelection(['b']);
    expect(store().activeMaterialSlot).toBe(0);
  });

  it('clamps a nonsense slot index', () => {
    store().setActiveMaterialSlot(-5);
    expect(store().activeMaterialSlot).toBe(0);
    store().setActiveMaterialSlot(Number.NaN);
    expect(store().activeMaterialSlot).toBe(0);
  });

  it('bumps the material epoch so the inspector re-reads live values', () => {
    const before = store().materialEpoch;
    store().bumpMaterialEpoch();
    expect(store().materialEpoch).toBe(before + 1);
  });

  it('keeps material state out of the store as three.js objects', () => {
    store().setActiveMaterialSlot(1);
    store().setSharedMaterialEditing(true);
    // Everything material-related in the store is a primitive.
    const snapshot = JSON.parse(
      JSON.stringify({
        activeMaterialSlot: store().activeMaterialSlot,
        sharedMaterialEditing: store().sharedMaterialEditing,
        materialEpoch: store().materialEpoch,
      }),
    );
    expect(snapshot).toEqual({ activeMaterialSlot: 1, sharedMaterialEditing: true, materialEpoch: 0 });
  });

  it('clears material state on reset', () => {
    store().setActiveMaterialSlot(2);
    store().setSharedMaterialEditing(true);
    store().bumpMaterialEpoch();

    store().resetEditor();

    expect(store().activeMaterialSlot).toBe(0);
    expect(store().sharedMaterialEditing).toBe(false);
    expect(store().materialEpoch).toBe(0);
  });
});

describe('useEditorStore - hierarchy and status', () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it('publishes and clears the serialisable tree', () => {
    const tree = [node('a', 'Cube'), node('b', 'Sphere')];
    store().setTree(tree);

    expect(store().tree).toHaveLength(2);
    // The tree is plain data: no three.js object ever enters the store.
    expect(JSON.parse(JSON.stringify(store().tree))).toEqual(tree);

    store().setTree(null);
    expect(store().tree).toBeNull();
  });

  it('bumps the transform epoch so panels re-read the live object', () => {
    const before = store().transformEpoch;
    store().bumpTransformEpoch();
    expect(store().transformEpoch).toBe(before + 1);
  });

  it('tracks a modified flag', () => {
    expect(store().isModified).toBe(false);
    store().setModified(true);
    expect(store().isModified).toBe(true);
  });

  it('toggles the hierarchy column', () => {
    expect(store().hierarchyOpen).toBe(true);
    store().toggleHierarchy();
    expect(store().hierarchyOpen).toBe(false);
    store().toggleHierarchy();
    expect(store().hierarchyOpen).toBe(true);
  });

  it('resets every editor-scoped slice', () => {
    store().setSelection(['a']);
    store().setHovered('a');
    store().setTree([node('a', 'Cube')]);
    store().setTransformMode('scale');
    store().setTransformSpace('local');
    store().setSnapEnabled(true);
    store().setModified(true);
    store().bumpTransformEpoch();
    store().bumpGeometryEpoch();
    store().bumpMaterialEpoch();
    store().setPrimitiveMenuOpen(true);

    store().resetEditor();

    const state = store();
    expect(state.selectedIds).toEqual([]);
    expect(state.hoveredId).toBeNull();
    expect(state.tree).toBeNull();
    expect(state.transformMode).toBe('translate');
    expect(state.transformSpace).toBe('world');
    expect(state.snapEnabled).toBe(false);
    expect(state.isModified).toBe(false);
    expect(state.transformEpoch).toBe(0);
    expect(state.geometryEpoch).toBe(0);
    expect(state.materialEpoch).toBe(0);
    expect(state.primitiveMenuOpen).toBe(false);
  });
});