import { useCallback, useMemo, useState } from 'react';
import type { Object3D } from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import {
  applyPosition,
  applyRotationDegrees,
  applyScale,
  formatTransform,
  readTransform,
  snapValue,
  type TransformValues,
} from '@/editor/transformMath';
import { EditorSection, NumberField } from './EditorPrimitives';
import { createTransformRig, resolveTransformTarget } from '@/editor/transformTarget';
import { recordHistory } from '@/editor/history/history';
import {
  captureEndpoints,
  sameTransform,
  type TransformEndpoint,
} from '@/editor/history/operations';
import { GeometrySection } from './GeometrySection';
import { MaterialSection } from './MaterialSection';
import { ObjectActions } from './ObjectActions';

/**
 * Right panel: the transform inspector for the current selection.
 *
 * The values are DERIVED during render from the live object in the registry
 * rather than mirrored into React state - the object is external, mutable
 * three.js state, and copying it into `useState` would both duplicate the
 * source of truth and re-render on every unrelated store change.
 *
 * `transformEpoch` is the signal that the object changed outside React: the
 * gizmo bumps it at the end of every drag, and committing a number bumps it
 * too, so the inputs and the viewport can never disagree.
 */

type AxisKey = 'position' | 'rotation' | 'scale';

const EMPTY: TransformValues = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

const AXES = ['X', 'Y', 'Z'] as const;

/** True when two endpoint lists describe the same poses. */
function endpointsEqual(before: TransformEndpoint[], after: TransformEndpoint[]): boolean {
  if (before.length !== after.length) return false;
  return before.every((endpoint, index) => sameTransform(endpoint.state, after[index]?.state ?? null));
}

export function TransformInspector() {
  const primaryId = useEditorStore((s) => s.selectedIds[0] ?? null);
  const transformEpoch = useEditorStore((s) => s.transformEpoch);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const translationSnap = useEditorStore((s) => s.translationSnap);
  const rotationSnap = useEditorStore((s) => s.rotationSnap);
  const scaleSnap = useEditorStore((s) => s.scaleSnap);

  const [scaleError, setScaleError] = useState<string | null>(null);

  // One snapshot read per render pass. `transformEpoch` is the signal that the
// object changed outside React (a finished gizmo drag or a committed number),
// so it is part of the snapshot and therefore a genuine dependency.
// The values shown and written are those of the object's TRANSFORM TARGET.
  // For a rigged mesh that is the skeleton root bone, because the mesh node's
  // own transform does not move the rendered skinned geometry - editing it
  // would change the numbers without changing anything on screen.
  const snapshot = useMemo(() => {
    const version = transformEpoch;
    const selected = primaryId ? getEditorWorkingScene()?.resolve(primaryId) : null;
    const target = resolveTransformTarget(selected);
    const driver = target?.driver ?? null;
    return {
      version,
      selected,
      driver,
      isSkeletal: target?.isSkeletal ?? false,
      values: driver ? formatTransform(readTransform(driver)) : EMPTY,
    };
  }, [primaryId, transformEpoch]);

  const object: Object3D | null = snapshot.driver;
  const values: TransformValues = snapshot.values;

  const setComponent = useCallback(
    (axis: AxisKey, index: number, raw: number) => {
      if (!object || !Number.isFinite(raw)) return;

      const snap =
        axis === 'position'
          ? translationSnap
          : axis === 'rotation'
            ? rotationSnap
            : scaleSnap;
const value = snapEnabled && snap > 0 ? snapValue(raw, snap) : raw;

      // Captured BEFORE the write, so undo returns the field to what it held.
      const working = getEditorWorkingScene();
      const before =
        working && primaryId
          ? captureEndpoints(working, object, snapshot.selected ?? null)
          : [];

      const next: TransformValues = {
        position: [...values.position],
        rotation: [...values.rotation],
        scale: [...values.scale],
      };
      next[axis][index] = value;

      // A zero scale is not invertible: it would make the object impossible to
      // recover through the gizmo, so it is rejected rather than applied.
      if (axis === 'scale' && next.scale.some((component) => component === 0)) {
        setScaleError('Scale cannot be zero.');
        return;
      }

      applyPosition(object, next.position);
      applyRotationDegrees(object, next.rotation);
      if (!applyScale(object, next.scale)) {
        setScaleError('Scale cannot be zero.');
        return;
      }

// Keep the selected mesh node in step with the skeleton so its frustum
      // bounds and selection outline continue to follow the rendered geometry.
      const rig = createTransformRig(object, snapshot.selected ?? null);
      rig.begin();
      rig.sync();

      // Numeric edits are recorded here rather than in the gizmo, and share a
      // coalesce key per object so a burst of field edits collapses into one
      // undo step instead of one per keystroke.
      if (working && primaryId) {
        const after = captureEndpoints(working, object, snapshot.selected ?? null);
        if (!endpointsEqual(before, after)) {
          recordHistory(
            { kind: 'transform', objectId: primaryId, before, after },
            `${axis === 'position' ? 'Move' : axis === 'rotation' ? 'Rotate' : 'Scale'} ${object.name || 'object'}`,
            `transform:${primaryId}`,
          );
        }
      }

      setScaleError(null);
      useEditorStore.getState().setModified(true);
      useEditorStore.getState().setDirty(true);
      useEditorStore.getState().bumpTransformEpoch();
    },
    [
      object,
      values,
      snapEnabled,
      translationSnap,
      rotationSnap,
      scaleSnap,
snapshot.selected,
      primaryId,
    ],
  );

  if (!primaryId || !object) {
    return (
      <p className="px-3 py-4 text-xs text-ink-faint" data-testid="transform-empty">
        Select an object in the viewport or the scene list to edit its transform.
      </p>
    );
  }

  return (
    <div data-testid="transform-inspector">
<ObjectActions />
      <GeometrySection />
      <MaterialSection />

      <EditorSection title="Position">
        <div className="flex gap-1.5">
          {AXES.map((axis, index) => (
            <NumberField
              key={`position-${axis}`}
              label={axis}
              testId={`transform-position-${axis}`}
              value={values.position[index] ?? 0}
              onCommit={(next) => setComponent('position', index, next)}
            />
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Rotation °">
        <div className="flex gap-1.5">
          {AXES.map((axis, index) => (
            <NumberField
              key={`rotation-${axis}`}
              label={axis}
              testId={`transform-rotation-${axis}`}
              value={values.rotation[index] ?? 0}
              onCommit={(next) => setComponent('rotation', index, next)}
            />
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Scale">
        <div className="flex gap-1.5">
          {AXES.map((axis, index) => (
            <NumberField
              key={`scale-${axis}`}
              label={axis}
              testId={`transform-scale-${axis}`}
              value={values.scale[index] ?? 1}
              onCommit={(next) => setComponent('scale', index, next)}
            />
          ))}
        </div>
      </EditorSection>

      {scaleError ? (
        <p role="alert" className="mt-2 text-xs text-danger" data-testid="transform-error">
          {scaleError}
        </p>
      ) : null}

      {snapshot.isSkeletal ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint" data-testid="transform-driver-note">
          Rigged mesh: transforms drive the skeleton root
          {' '}
          <span className="font-mono text-ink-muted">{snapshot.driver?.name ?? '—'}</span>
          .
        </p>
      ) : null}
    </div>
  );
}
