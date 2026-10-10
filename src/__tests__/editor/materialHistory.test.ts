import { describe, expect, it, beforeEach } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material } from 'three';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import { setEditorWorkingScene } from '@/editor/editorRuntime';
import { clearHistory, redo, undo } from '@/editor/history/history';
import {
  captureMaterialState,
  captureSnapshotState,
  invertOp,
  restoreSnapshotState,
  writeMaterialValue,
} from '@/editor/history/operations';
import { setMaterialColorAction } from '@/editor/editorCommands';
import { buildPrimitiveGeometry, defaultParams } from '@/editor/primitives';

/**
 * Material undo/redo.
 *
 * The behaviour that matters most here is copy-on-write: editing one object's
 * material CLONES it for that one slot, and undo has to put the ORIGINAL
 * material back rather than leaving a detached clone holding the old colour.
 */

/** Reads a colour the same way history does, so comparisons are exact. */
function readColor(material: Material): string {
  const color = (material as unknown as { color?: { getHexString: () => string } }).color;
  return color ? `#${color.getHexString()}` : '#000000';
}

/** Two meshes sharing ONE material, which is what makes copy-on-write engage. */
function sharedMaterialScene(): { working: WorkingScene; ids: string[] } {
  const root = new Group();
  root.name = 'Source';
  const shared = new MeshStandardMaterial({ color: 0x336699, roughness: 0.25, metalness: 0.5 });

  const first = new Mesh(buildPrimitiveGeometry('box', defaultParams('box')), shared);
  first.name = 'First';
  const second = new Mesh(buildPrimitiveGeometry('sphere', defaultParams('sphere')), shared);
  second.name = 'Second';
  root.add(first, second);

  const working = createWorkingScene(root, { idPrefix: 'm' });
  const ids = working.registry.ids().filter((id) => {
    const name = working.resolve(id)?.name;
    return name === 'First' || name === 'Second';
  });
  return { working, ids };
}

beforeEach(() => {
  clearHistory();
  setEditorWorkingScene(null);
});

describe('copy-on-write material editing', () => {
  it('clones a shared material for one slot and leaves the other user alone', () => {
    const { working, ids } = sharedMaterialScene();
    const first = working.resolve(ids[0] as string) as Mesh;
    const second = working.resolve(ids[1] as string) as Mesh;

    // Both start out sharing one instance.
    const sharedBefore = first.material as Material;
    expect(second.material).toBe(sharedBefore);

    const owned = working.takeOwnershipOfMaterial(first, 0) as Material;
    expect(owned).not.toBe(sharedBefore);
    expect(first.material).toBe(owned);
    // The neighbour keeps the original, so editing one cannot restyle it.
    expect(second.material).toBe(sharedBefore);

    writeMaterialValue(owned, 'color', '#ff0000');
    expect(readColor(owned)).toBe('#ff0000');
    expect(readColor(second.material as Material)).toBe('#336699');
  });

  it('records different material identities either side of a copy-on-write edit', () => {
    const { working, ids } = sharedMaterialScene();
    const first = working.resolve(ids[0] as string) as Mesh;
    const original = first.material as Material;

    const before = captureMaterialState(working, original, 'color');
    const owned = working.takeOwnershipOfMaterial(first, 0) as Material;
    writeMaterialValue(owned, 'color', '#00ff00');
    const after = captureMaterialState(working, owned, 'color');

    expect(before.materialId).not.toBe(after.materialId);
    expect(readColor(owned)).toBe('#00ff00');
  });
});

describe('material property undo through the history engine', () => {
  it('restores the original colour and replays it on redo', () => {
    const { working, ids } = sharedMaterialScene();
    setEditorWorkingScene(working);
    const firstId = ids[0] as string;
    const secondId = ids[1] as string;
    const first = working.resolve(firstId) as Mesh;
    const second = working.resolve(secondId) as Mesh;
    const sharedBefore = first.material as Material;

    // The two meshes share a material, so this write is copy-on-write: the
    // colour must land on a CLONE and leave the original alone.
    setMaterialColorAction(firstId, 0, '#00ff00');

    const owned = first.material as Material;
    expect(owned).not.toBe(sharedBefore);
    expect(readColor(owned)).toBe('#00ff00');
    // The neighbour was never restyled.
    expect(second.material).toBe(sharedBefore);
    expect(readColor(second.material as Material)).toBe('#336699');

    // Undo must put the ORIGINAL material back in the slot, not just recolour
    // the clone - otherwise a detached clone would be left holding the old value.
    undo();
    expect((working.resolve(firstId) as Mesh).material).toBe(sharedBefore);
    expect((working.resolve(secondId) as Mesh).material).toBe(sharedBefore);
    expect(readColor(sharedBefore)).toBe('#336699');

    redo();
    expect(readColor((working.resolve(firstId) as Mesh).material as Material)).toBe('#00ff00');
  });

  it('undoes a scalar write without disturbing colour', () => {
    const { working, ids } = sharedMaterialScene();
    setEditorWorkingScene(working);
    const id = ids[0] as string;
    const material = (working.resolve(id) as Mesh).material as MeshStandardMaterial;

    const before = captureMaterialState(working, material, 'roughness');
    expect(before.value).toBe(0.25);

    writeMaterialValue(material, 'roughness', 0.9);
    const after = captureMaterialState(working, material, 'roughness');
    expect(after.value).toBe(0.9);

    // A manual inversion is exactly what the history engine performs.
    const op = {
      kind: 'materialValue' as const,
      objectId: id,
      slot: 0,
      property: 'roughness' as const,
      before,
      after,
    };
    const inverse = invertOp(op);
    expect(inverse).not.toBeNull();
    // The inverse swaps the two states: its `before` is the redo target.
    expect(inverse).toMatchObject({ before: after, after: before });

    const flipped = inverse as typeof op;
    writeMaterialValue(material, 'roughness', flipped.before.value);
    expect(material.roughness).toBe(0.9);

    writeMaterialValue(material, 'roughness', flipped.after.value);
    expect(material.roughness).toBe(0.25);
    // The colour was never part of this step, so it must be untouched.
    expect(readColor(material)).toBe('#336699');
  });
});

describe('material snapshots', () => {
  it('captures every restored property, including transparency', () => {
    const material = new MeshStandardMaterial({ color: 0x112233, roughness: 0.3 });
    const working = createWorkingScene(new Group(), { idPrefix: 's' });

    const before = captureSnapshotState(working, material);
    material.color.set('#ff00ff');
    material.roughness = 1;
    material.opacity = 0.25;
    material.transparent = true;
    const after = captureSnapshotState(working, material);

    expect(after.snapshot.opacity).toBe(0.25);
    expect(after.snapshot.transparent).toBe(true);
    expect(before.snapshot.opacity).toBe(1);

    restoreSnapshotState(material, before.snapshot);
    expect(readColor(material)).toBe('#112233');
    expect(material.roughness).toBe(0.3);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
  });

  it('leaves a non-PBR material without meaningless fields', () => {
    const basic = new MeshBasicMaterial({ color: 0x445566 });
    const working = createWorkingScene(new Group(), { idPrefix: 'b' });
    const snapshot = captureSnapshotState(working, basic).snapshot;

    expect(snapshot.roughness).toBeNull();
    expect(snapshot.metalness).toBeNull();
    expect(snapshot.color).toBeTruthy();
  });
});