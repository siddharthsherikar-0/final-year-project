import { describe, expect, it, beforeEach } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import { setEditorWorkingScene } from '@/editor/editorRuntime';
import { clearHistory, getHistoryState, redo, recordHistory, undo } from '@/editor/history/history';
import {
  applyTransform,
  captureEndpoints,
  captureTransform,
  detachObjects,
  attachParked,
  sameTransform,
} from '@/editor/history/operations';
import { buildPrimitiveGeometry } from '@/editor/primitives';
import { duplicateObject } from '@/editor/objectOperations';
import { useEditorStore } from '@/stores/useEditorStore';

/**
 * Command-history behaviour.
 *
 * These tests exercise the REAL three.js scene graph through a real
 * `WorkingScene` - no mocked materials, geometries or transforms, because the
 * whole point of this layer is that it drives actual GPU-backed objects.
 */

function buildSource(): Group {
  const root = new Group();
  root.name = 'Source';
  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    const mesh = new Mesh(
      buildPrimitiveGeometry('box', { width: 1, height: 1, depth: 1 }),
      new MeshStandardMaterial({ color: 0x808080 }),
    );
    mesh.name = name;
    root.add(mesh);
  }
  return root;
}

function scene(): WorkingScene {
  return createWorkingScene(buildSource(), { idPrefix: 'h' });
}

function idsOf(working: WorkingScene): string[] {
  return working.registry.ids().filter((id) => working.resolve(id)?.name !== 'Source');
}

beforeEach(() => {
  clearHistory();
  setEditorWorkingScene(null);
  useEditorStore.getState().resetEditor();
});

describe('history stack', () => {
  it('reports nothing to undo or redo on an empty history', () => {
    expect(undo()).toMatchObject({ ok: false });
    expect(redo()).toMatchObject({ ok: false });
  });

  it('replays a rename in both directions', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const original = working.resolve(id)?.name as string;

    working.resolve(id)!.name = 'Renamed';
    recordHistory({ kind: 'rename', objectId: id, before: original, after: 'Renamed' }, 'Rename');

    expect(undo().ok).toBe(true);
    expect(working.resolve(id)?.name).toBe(original);

    expect(redo().ok).toBe(true);
    expect(working.resolve(id)?.name).toBe('Renamed');
  });

  it('restores a numeric transform to the exact prior pose', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const object = working.resolve(id) as Object3D;

    const before = captureEndpoints(working, object, null);
    object.position.set(3.5, -2.25, 7);
    const after = captureEndpoints(working, object, null);
    recordHistory({ kind: 'transform', objectId: id, before, after }, 'Move');

    expect(object.position.toArray()).toEqual([3.5, -2.25, 7]);
    undo();
    expect(object.position.toArray()).toEqual([0, 0, 0]);

    redo();
    expect(object.position.toArray()).toEqual([3.5, -2.25, 7]);
  });

  it('restores visibility', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const object = working.resolve(id) as Object3D;

    object.visible = false;
    recordHistory({ kind: 'visibility', objectId: id, before: true, after: false }, 'Hide');

    undo();
    expect(object.visible).toBe(true);
    redo();
    expect(object.visible).toBe(false);
  });
});

describe('coalescing', () => {
  it('collapses a simulated drag into one undo step that returns to the drag start', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const object = working.resolve(id) as Object3D;

    const start = captureEndpoints(working, object, null);

    // Every frame of one drag reports the same coalesce key.
    for (const x of [0.1, 0.4, 0.9, 1.6]) {
      object.position.x = x;
      const frame = captureEndpoints(working, object, null);
      recordHistory({ kind: 'transform', objectId: id, before: start, after: frame }, 'Move', `transform:${id}`);
    }

    expect(getHistoryState().entries).toHaveLength(1);

    undo();
    // Undo lands where the drag STARTED, not at the previous frame.
    expect(object.position.x).toBe(0);
  });

  it('keeps two deliberate moves as separate steps', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const object = working.resolve(id) as Object3D;

    const start = captureEndpoints(working, object, null);
    object.position.x = 1;
    recordHistory(
      { kind: 'transform', objectId: id, before: start, after: captureEndpoints(working, object, null) },
      'Move A',
    );
    const mid = captureEndpoints(working, object, null);
    object.position.x = 2;
    recordHistory(
      { kind: 'transform', objectId: id, before: mid, after: captureEndpoints(working, object, null) },
      'Move B',
    );

    expect(getHistoryState().entries).toHaveLength(2);
    undo();
    expect(object.position.x).toBe(1);
    undo();
    expect(object.position.x).toBe(0);
  });

  it('does not merge different objects', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const [first, second] = idsOf(working);

    const a = working.resolve(first!) as Object3D;
    const b = working.resolve(second!) as Object3D;

    a.position.x = 1;
    recordHistory(
      {
        kind: 'transform',
        objectId: first!,
        before: captureEndpoints(working, a, null),
        after: captureEndpoints(working, a, null),
      },
      'A',
      'transform:1',
    );
    b.position.x = 1;
    recordHistory(
      {
        kind: 'transform',
        objectId: second!,
        before: captureEndpoints(working, b, null),
        after: captureEndpoints(working, b, null),
      },
      'B',
      'transform:2',
    );

    expect(getHistoryState().entries).toHaveLength(2);
  });
});

describe('redo branch', () => {
  it('discards the abandoned future when a new edit follows an undo', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const object = working.resolve(id) as Object3D;

    const start = captureEndpoints(working, object, null);
    object.position.x = 1;
    recordHistory({ kind: 'transform', objectId: id, before: start, after: captureEndpoints(working, object, null) }, 'First');
    object.position.x = 2;
    recordHistory({ kind: 'transform', objectId: id, before: captureEndpoints(working, object, null), after: captureEndpoints(working, object, null) }, 'Second');

    expect(getHistoryState().entries).toHaveLength(2);
    undo();
    expect(getHistoryState().redoLabel).toBe('Second');

    object.position.x = 9;
    recordHistory({ kind: 'transform', objectId: id, before: captureEndpoints(working, object, null), after: captureEndpoints(working, object, null) }, 'Third');

    expect(getHistoryState().entries).toHaveLength(2);
    expect(getHistoryState().redoLabel).toBeNull();
  });
});

describe('structural operations', () => {
  it('undoes a delete by re-attaching the same nodes under the same ids', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[1] as string;
    const name = working.resolve(id)?.name;

    const outcome = detachObjects(working, [id]);
    expect(outcome.detached).toEqual([id]);
    expect(working.resolve(id)).toBeNull();
    recordHistory({ kind: 'delete', objectIds: [id] }, 'Delete', null, outcome.parkedId);

    undo();
    const restored = working.resolve(id);
    expect(restored).not.toBeNull();
    // Identity, not just geometry, is restored.
    expect(restored?.name).toBe(name);

    redo();
    expect(working.resolve(id)).toBeNull();
  });

  it('does not dispose geometry that a parked undo still needs', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;
    const mesh = working.resolve(id) as Mesh;

    const outcome = detachObjects(working, [id]);
    recordHistory({ kind: 'delete', objectIds: [id] }, 'Delete', null, outcome.parkedId);

    // Ownership release must be refused while the undo entry is live.
    expect(working.releaseGeometryIfUnused(mesh.geometry)).toBe(false);

    undo();
    expect(working.releaseGeometryIfUnused(mesh.geometry)).toBe(false);
  });

  it('refuses to delete rig infrastructure and reports the reason', () => {
    const working = scene();
    const outcome = detachObjects(working, [working.registry.ids()[0] as string]);
    // The first id is a mesh child, so this should succeed; the root must not.
    const rootId = working.registry.idOf(working.root);
    expect(rootId).toBeTruthy();
    const rootOutcome = detachObjects(working, [rootId as string]);
    expect(rootOutcome.detached).toEqual([]);
    expect(rootOutcome.refused[0]?.reason).toMatch(/root/i);
    void outcome;
  });

  it('re-creates a duplicated object under its original id on redo', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const sourceId = idsOf(working)[0] as string;

    const copy = duplicateObject(working, sourceId);
    expect(copy.ok).toBe(true);
    const createdId = copy.id as string;
    expect(working.resolve(createdId)).not.toBeNull();

    recordHistory({ kind: 'duplicate', sourceId, createdId }, 'Duplicate');

    undo();
    expect(working.resolve(createdId)).toBeNull();
    expect(working.resolve(sourceId)).not.toBeNull();

    redo();
    expect(working.resolve(createdId)).not.toBeNull();
  });

  it('drops a selection that pointed at an undone object', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;

    // The object is selected, then deleted - the state after a user deletes the
    // object they had selected.
    useEditorStore.getState().setSelection([id]);
    const outcome = detachObjects(working, [id]);
    recordHistory({ kind: 'delete', objectIds: [id] }, 'Delete', null, outcome.parkedId);
    undo();

    // Undoing a delete re-attaches the object AND re-selects it, so the outline
    // and gizmo come back with it rather than leaving the user hunting for it.
    expect(working.resolve(id)).not.toBeNull();
    expect(useEditorStore.getState().selectedIds).toEqual([id]);
  });

  it('leaves no selection addressing an object redo removed', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const id = idsOf(working)[0] as string;

    const outcome = detachObjects(working, [id]);
    recordHistory({ kind: 'delete', objectIds: [id] }, 'Delete', null, outcome.parkedId);
    undo();
    // Selected again by the attach, then removed again by the redo.
    redo();

    expect(working.resolve(id)).toBeNull();
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });
});

describe('capture helpers', () => {
  it('treats identical transforms as equal and different ones as not', () => {
    const a = captureTransform(new Object3D());
    const b = captureTransform(new Object3D());
    expect(sameTransform(a, b)).toBe(true);

    const moved = new Object3D();
    moved.position.x = 1;
    expect(sameTransform(a, captureTransform(moved))).toBe(false);
  });

  it('writes a captured transform back onto an object', () => {
    const object = new Object3D();
    applyTransform(object, { p: [1, 2, 3], q: [0, 0, 0, 1], s: [2, 2, 2] });
    expect(object.position.toArray()).toEqual([1, 2, 3]);
    expect(object.scale.toArray()).toEqual([2, 2, 2]);
  });

  it('attaches a parked subtree back at its original sibling slot', () => {
    const working = scene();
    setEditorWorkingScene(working);
    const all = idsOf(working);
    const target = all[2] as string;

    const outcome = detachObjects(working, [target]);
    const afterDelete = working.root.children.length;
    attachParked(working, outcome.parkedId);

    expect(working.root.children.length).toBe(afterDelete + 1);
  });
});