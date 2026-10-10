import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import {
  PRIMITIVE_DEFS,
  readPrimitiveMeta,
  validatePrimitiveParams,
  type PrimitiveParams,
} from '@/editor/primitives';
import { regeneratePrimitiveAction } from '@/editor/editorCommands';
import { DraftNumberField, EditorSection } from './EditorPrimitives';

/**
 * Contextual Geometry section.
 *
 * Shows the real parameters of a selected editor-created primitive. Imported
 * meshes get a clear read-only note instead of irrelevant primitive fields.
 *
 * Values are DERIVED from the live mesh on every render and keyed on
 * `geometryEpoch`, which the command layer bumps after a create / regenerate /
 * duplicate / delete. Edits commit on blur or Enter so a keystroke never
 * rebuilds a 16x48 torus.
 */

export function GeometrySection() {
  const primaryId = useEditorStore((s) => s.selectedIds[0] ?? null);
  const geometryEpoch = useEditorStore((s) => s.geometryEpoch);
  // signal that the live mesh changed outside React, and must gate the read.
  const snapshot = (() => {
    const working = getEditorWorkingScene();
    const mesh = working?.resolve(primaryId) ?? null;
    const meta = mesh ? readPrimitiveMeta(mesh) : null;
    return { mesh, meta };
  })();
  void geometryEpoch;

  const { mesh, meta } = snapshot;

  if (!primaryId) return null;

  if (!meta) {
    const isMesh = (mesh as { isMesh?: boolean } | null)?.isMesh === true;
    const isSkinned = (mesh as { isSkinnedMesh?: boolean } | null)?.isSkinnedMesh === true;
    if (!isMesh) return null;

    return (
      <div data-testid="geometry-readonly">
        <EditorSection title="Geometry">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            {isSkinned
              ? 'Imported rigged mesh. Its geometry comes from the source GLB and is read-only.'
              : 'Imported mesh. Its geometry comes from the source GLB and is read-only.'}
          </p>
        </EditorSection>
      </div>
    );
  }

  const def = PRIMITIVE_DEFS[meta.kind];
  if (!def) return null;

  const commit = (key: string, raw: number) => {
    const next: PrimitiveParams = { ...meta.params, [key]: raw };
    const validated = validatePrimitiveParams(meta.kind, next);
    // Invalid intermediate input is rejected; the field keeps its own value.
    if (!validated.ok) return;
    regeneratePrimitiveAction(primaryId, validated.params);
  };

  return (
    <div data-testid="geometry-section">
      <EditorSection title="Geometry">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
          {def.label}
        </p>
        <div className="flex flex-wrap gap-2">
          {def.params.map((spec) => (
            <DraftNumberField
              key={spec.key}
              label={spec.label}
              testId={`geometry-${meta.kind}-${spec.key}`}
              step={spec.step}
              value={meta.params[spec.key] ?? 0}
              title={`${spec.label}: ${spec.min}–${spec.max}`}
              onCommit={(next) => commit(spec.key, next)}
            />
          ))}
        </div>
      </EditorSection>
    </div>
  );
}
