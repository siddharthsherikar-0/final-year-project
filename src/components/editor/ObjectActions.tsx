import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import {
  deleteAction,
  deleteCapability,
  duplicateAction,
  duplicateCapability,
  groupAction,
  groupCapability,
  renameAction,
  ungroupAction,
  ungroupCapability,
} from '@/editor/editorCommands';
import { EditorSection, ToolbarButton } from './EditorPrimitives';

/**
 * Contextual object operations for the current selection.
 *
 * Every control is either genuinely actionable or explicitly disabled with a
 * reason - there are no buttons that silently do nothing. Refusals (for example
 * duplicating a rigged character) are explained rather than hidden.
 */

export function ObjectActions() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const geometryEpoch = useEditorStore((s) => s.geometryEpoch);
  const primaryId = selectedIds[0] ?? null;
  // signal that the live scene changed outside React.
  const name = (() => {
    const working = getEditorWorkingScene();
    const object = working?.resolve(primaryId) ?? null;
    return typeof object?.name === 'string' ? object.name : '';
  })();
  void geometryEpoch;

  const [draft, setDraft] = useState<string | null>(null);
  if (!primaryId) return null;

  const duplicate = duplicateCapability(primaryId);
  const remove = deleteCapability(primaryId);
  const group = groupCapability(selectedIds);
  const ungroup = ungroupCapability(primaryId);

  const blockedReason = [duplicate, remove, group, ungroup]
    .map((c) => (c.allowed ? null : c.reason))
    .find(Boolean);

  return (
    <div data-testid="object-actions">
      <EditorSection title="Object">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
            Name
          </span>
          <input
            type="text"
            value={draft ?? name}
            data-testid="object-name"
            aria-label="Object name"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft === null) return;
              const next = draft;
              setDraft(null);
              if (next.trim() === name) return;
              renameAction(primaryId, next);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            }}
            className="min-w-0 rounded-md border border-control bg-canvas px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:border-accent/60"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <ToolbarButton
            label="Duplicate"
            disabled={!duplicate.allowed}
            title={duplicate.allowed ? 'Duplicate this object' : duplicate.reason}
            onClick={() => duplicateAction(primaryId)}
          />
          <ToolbarButton
            label="Group"
            disabled={!group.allowed}
            title={group.allowed ? 'Group the selection' : group.reason}
            onClick={() => groupAction(selectedIds)}
          />
          <ToolbarButton
            label="Ungroup"
            disabled={!ungroup.allowed}
            title={ungroup.allowed ? 'Remove this group' : ungroup.reason}
            onClick={() => ungroupAction(primaryId)}
          />
          <ToolbarButton
            label="Delete"
            disabled={!remove.allowed}
            title={remove.allowed ? 'Delete this object' : remove.reason}
            onClick={() => deleteAction([primaryId])}
          />
        </div>

        {blockedReason && !remove.allowed ? (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{blockedReason}</p>
        ) : null}
      </EditorSection>
    </div>
  );
}
