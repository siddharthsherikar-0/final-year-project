import type { WorkingScene } from './workingScene';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/**
 * Editor runtime bridge.
 *
 * Holds the live working scene so the in-Canvas editor layer (gizmo, outline,
 * pointer picking) can reach the objects it owns. This is deliberately a
 * SEPARATE singleton from `viewerRuntime`: the viewer singleton's semantics
 * are frozen Stage 8 contract and must not change.
 *
 * Nothing here is React state - the Zustand editor store only ever holds ids.
 */
export interface EditorRuntime {
  workingScene: WorkingScene | null;
  /**
   * Read-only handle on the orbit controls, used to decide where a newly
   * created object should appear (the point the user is looking at). It is
   * never mutated from the editor.
   */
  controls: OrbitControlsImpl | null;
  /**
   * Handle on the live transform gizmo.
   *
   * Deleting or ungrouping the selected object removes it from the scene graph,
   * but React only re-renders on the next tick. Without a synchronous detach,
   * three.js renders one frame with the gizmo still attached to a detached
   * object and logs "The attached 3D object must be a part of the scene graph".
   * Destructive commands therefore detach first, then mutate.
   */
  transformControls: { detach: () => void } | null;
}

export const editorRuntime: EditorRuntime = {
  workingScene: null,
  controls: null,
  transformControls: null,
};

export function setEditorWorkingScene(scene: WorkingScene | null): void {
  editorRuntime.workingScene = scene;
}

export function getEditorWorkingScene(): WorkingScene | null {
  return editorRuntime.workingScene;
}

/** Registers the live controls for read-only placement queries. */
export function setEditorControls(controls: OrbitControlsImpl | null): void {
  editorRuntime.controls = controls;
}

export function getEditorControls(): OrbitControlsImpl | null {
  return editorRuntime.controls;
}

/** Registers the live gizmo so destructive commands can detach it safely. */
export function setEditorTransformControls(
  controls: { detach: () => void } | null,
): void {
  editorRuntime.transformControls = controls;
}

/**
 * Detaches the gizmo from whatever it is attached to.
 *
 * Safe to call when nothing is attached. Called BEFORE an object is removed
 * from the scene graph so three.js never renders a frame with the gizmo
 * pointing at a detached object.
 */
export function detachEditorTransformControls(): void {
  try {
    editorRuntime.transformControls?.detach();
  } catch {
    // A gizmo that is already detached must never break the command.
  }
}