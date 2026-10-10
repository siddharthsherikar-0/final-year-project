import { useEffect, useMemo, useRef } from 'react';
import { LineBasicMaterial, LineSegments } from 'three';
import type { Mesh as ThreeMesh } from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import { TransformControls } from '@react-three/drei';
import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene, setEditorTransformControls } from '@/editor/editorRuntime';
import { outlineGeometryFor } from '@/editor/outline';
import { createTransformRig, resolveTransformTarget } from '@/editor/transformTarget';
import { recordHistory } from '@/editor/history/history';
import { captureEndpoints, sameTransform, type TransformEndpoint } from '@/editor/history/operations';
import { markEditorHelper } from '@/editor/projects/glbExport';

/** True when any endpoint moved, so a no-op drag records nothing. */
function endpointsDiffer(before: TransformEndpoint[], after: TransformEndpoint[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((endpoint, index) => !sameTransform(endpoint.state, after[index]?.state ?? null));
}

/**
 * Editor layer inside the existing Canvas.
 *
 * Adds only two things to the R3F tree: a drei `TransformControls` gizmo for
 * the active selection, and an accent outline on selected meshes. It creates no
 * canvas, no renderer and no render loop - drei's TransformControls disables
 * OrbitControls itself while a drag is in progress.
 *
 * The gizmo is attached to the object's TRANSFORM TARGET, not blindly to the
 * selected mesh: a rigged SkinnedMesh is driven through its skeleton root bone
 * (see `transformTarget.ts`), because the mesh node's own transform does not
 * affect skinned rendering. For an ordinary mesh the target is the object
 * itself and behaviour is unchanged.
 */

const OUTLINE_COLOR = '#c8a24a';

function SelectionOutline({ object }: { object: ThreeMesh }) {
  const geometry = useMemo(() => {
    const mesh = object as ThreeMesh;
    return outlineGeometryFor(mesh.geometry);
  }, [object]);

  useEffect(() => {
    if (!geometry) return undefined;
    const material = new LineBasicMaterial({
      color: OUTLINE_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    // Added imperatively: the object lives in the working scene, not in JSX.
const line = new LineSegments(geometry, material);
    line.renderOrder = 999;
    line.frustumCulled = false;
    // The highlight must never become a pickable scene hit.
    line.raycast = () => {};
    // Tagged so a GLB export can strip it: the accent outline is an editor
    // affordance, not geometry the user made.
    markEditorHelper(line);
    object.add(line);

    return () => {
      object.remove(line);
      material.dispose();
    };
  }, [object, geometry]);

  return null;
}

export function EditorLayer() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const transformMode = useEditorStore((s) => s.transformMode);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const translationSnap = useEditorStore((s) => s.translationSnap);
  const rotationSnap = useEditorStore((s) => s.rotationSnap);
  const scaleSnap = useEditorStore((s) => s.scaleSnap);

const working = getEditorWorkingScene();

  /**
   * Bumped whenever the scene graph is mutated structurally.
   *
   * This is a REQUIRED dependency of the selection memo below, not decoration.
   * Undo/redo can delete an object and then recreate the very same id, and the
   * scene instance plus the id string both stay identical across that round
   * trip. Without this counter the memo would keep returning the stale `null` it
   * cached while the object was missing, and the recreated object would come back
   * with no outline and no gizmo.
   */
  const geometryEpoch = useEditorStore((s) => s.geometryEpoch);

  // The gizmo drives exactly one object: the primary selection (the first id).
  // Multi-object gizmo transforms are deliberately deferred - see the report.
  const primaryId = selectedIds[0] ?? null;
  const selected = useMemo(() => {
    // Referenced deliberately: `geometryEpoch` invalidates this memo whenever the
    // graph is rebuilt. Without it the memo would keep serving the `null` it
    // cached while an object was missing, so an object recreated by undo under
    // the same id would return with no outline and no gizmo.
    void geometryEpoch;
    if (!primaryId) return null;
    return working?.resolve(primaryId) ?? null;
  }, [working, primaryId, geometryEpoch]);

  const target = useMemo(() => resolveTransformTarget(selected), [selected]);

  // Baseline for the follower delta. Re-captured whenever the selection
  // changes so a drag always measures from the object's current pose.
  const rig = useMemo(
    () => (target ? createTransformRig(target.driver, target.follower) : null),
    [target],
  );

  useEffect(() => {
    rig?.begin();
  }, [rig]);

  // Publish the live gizmo so destructive commands can detach it before the
  // attached object leaves the scene graph.
  const controlsRef = useRef<TransformControlsImpl | null>(null);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    setEditorTransformControls(controls);
    return () => {
      if (controls) setEditorTransformControls(null);
    };
  });

/**
   * Baseline captured at drag start.
   *
   * A drag fires `objectChange` on every frame, so history is written once on
   * release, from the pose captured when the button went down. That is what makes
   * one gesture one undo step - and why undo returns to where the drag STARTED
   * rather than to the previous frame.
   *
   * For a rigged object BOTH the driver and the follower are recorded, because
   * the gizmo moves the skeleton root while the mesh node is kept in sync as a
   * follower; restoring only one would leave the rig inconsistent.
   *
   * Declared before the early return below so hook order is identical on every
   * render, whether or not a gizmo is currently mounted.
   */
  const dragStartRef = useRef<TransformEndpoint[]>([]);

  if (!target || !rig) return null;

  const onDragStart = () => {
    rig.begin();
    const working = getEditorWorkingScene();
    dragStartRef.current = working
      ? captureEndpoints(working, target.driver, target.follower)
      : [];
  };

  const onDragEnd = () => {
    rig.sync();
    const working = getEditorWorkingScene();
    const objectId = primaryId;
    if (!working || !objectId) {
      useEditorStore.getState().bumpTransformEpoch();
      return;
    }

    const after = captureEndpoints(working, target.driver, target.follower);
    const before = dragStartRef.current.length === after.length ? dragStartRef.current : after;
    dragStartRef.current = [];

    // A drag that returned to its exact starting pose is not an edit and must
    // not leave an entry that would undo to a no-op.
    if (!endpointsDiffer(before, after)) {
      useEditorStore.getState().bumpTransformEpoch();
      return;
    }

    recordHistory(
      { kind: 'transform', objectId, before, after },
      `${transformMode === 'translate' ? 'Move' : transformMode === 'rotate' ? 'Rotate' : 'Scale'} ${working.resolve(objectId)?.name ?? 'object'}`,
      // Every frame of this drag shares a key, so the entries coalesce.
      `transform:${objectId}`,
    );

    useEditorStore.getState().bumpTransformEpoch();
    useEditorStore.getState().setModified(true);
    useEditorStore.getState().setDirty(true);
  };

  return (
    <>
      <TransformControls
        ref={controlsRef}
        object={target.driver}
        mode={transformMode}
        space={transformSpace}
        translationSnap={snapEnabled ? translationSnap : null}
        rotationSnap={snapEnabled ? rotationSnap : null}
        scaleSnap={snapEnabled ? scaleSnap : null}
        size={0.85}
onMouseDown={onDragStart}
        onObjectChange={() => rig.sync()}
        onMouseUp={onDragEnd}
      />
      {selected ? <SelectionOutline object={selected as ThreeMesh} /> : null}
    </>
  );
}
