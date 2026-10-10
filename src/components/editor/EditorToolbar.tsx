import { useEffect } from 'react';
import { useEditorStore, type TransformMode } from '@/stores/useEditorStore';
import { useViewerStore } from '@/stores/useViewerStore';
import { ToolbarButton } from './EditorPrimitives';
import { PrimitiveMenu } from './PrimitiveMenu';
import { ProjectMenu } from './ProjectMenu';
import { undoAction, redoAction } from '@/editor/history/commands';

/**
 * Top toolbar for the editor workspace.
 *
 * Undo/redo are driven by the command history in `editor/history`, and their
 * enabled state comes from the store so a button can never look available when
 * there is nothing to step back to.
 */

const MODES: ReadonlyArray<{ id: TransformMode; label: string; title: string }> = [
  { id: 'translate', label: 'Move', title: 'Move tool (W)' },
  { id: 'rotate', label: 'Rotate', title: 'Rotate tool (E)' },
  { id: 'scale', label: 'Scale', title: 'Scale tool (R)' },
];

/** True when focus is in a field, where a bare letter key must not be a shortcut. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true;
}

export function EditorToolbar() {
  const transformMode = useEditorStore((s) => s.transformMode);
  const setTransformMode = useEditorStore((s) => s.setTransformMode);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const setTransformSpace = useEditorStore((s) => s.setTransformSpace);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const setSnaps = useEditorStore((s) => s.setSnaps);
  const translationSnap = useEditorStore((s) => s.translationSnap);
  const rotationSnap = useEditorStore((s) => s.rotationSnap);
  const scaleSnap = useEditorStore((s) => s.scaleSnap);
  const hierarchyOpen = useEditorStore((s) => s.hierarchyOpen);
  const toggleHierarchy = useEditorStore((s) => s.toggleHierarchy);
  // Shares the Stage 8 panel flag, so this toggle, the page toolbar button and
  // the panel's close control can never disagree.
const panelOpen = useViewerStore((s) => s.panelOpen);
  const setPanelOpen = useViewerStore((s) => s.setPanelOpen);
  const history = useEditorStore((s) => s.history);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (plus the Ctrl+Y form) step the history.
  // Typing in a field is excluded, so the shortcuts never eat a user's text.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      if (isUndo) undoAction();
      else redoAction();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-surface px-2 py-1.5"
      role="toolbar"
      aria-label="Editor tools"
    >
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Panels">
        <ToolbarButton
          label="Scene"
          title="Show or hide the scene hierarchy"
          active={hierarchyOpen}
          pressed={hierarchyOpen}
          onClick={toggleHierarchy}
        />
        <ToolbarButton
          label="Inspector"
          title="Show or hide the inspector"
          active={panelOpen}
          pressed={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="History">
        <ToolbarButton
          label="Undo"
          title={
            history.canUndo
              ? `Undo ${history.undoLabel ?? 'change'} (Ctrl+Z)`
              : 'Nothing to undo'
          }
          disabled={!history.canUndo}
          onClick={undoAction}
          testId="toolbar-undo"
        />
        <ToolbarButton
          label="Redo"
          title={
            history.canRedo
              ? `Redo ${history.redoLabel ?? 'change'} (Ctrl+Shift+Z)`
              : 'Nothing to redo'
          }
          disabled={!history.canRedo}
          onClick={redoAction}
          testId="toolbar-redo"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Transform tool">
        {MODES.map((mode) => (
          <ToolbarButton
            key={mode.id}
            label={mode.label}
            title={mode.title}
            active={transformMode === mode.id}
            pressed={transformMode === mode.id}
            onClick={() => setTransformMode(mode.id)}
          />
        ))}
      </div>

      <div className="hidden shrink-0 items-center gap-1 sm:flex" role="group" aria-label="Transform space">
        <ToolbarButton
          label="World"
          title="Transform in world space"
          active={transformSpace === 'world'}
          pressed={transformSpace === 'world'}
          onClick={() => setTransformSpace('world')}
        />
        <ToolbarButton
          label="Local"
          title="Transform in local space"
          active={transformSpace === 'local'}
          pressed={transformSpace === 'local'}
          onClick={() => setTransformSpace('local')}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Snapping">
        <ToolbarButton
          label="Snap"
          title="Snap transforms to increments"
          active={snapEnabled}
          pressed={snapEnabled}
          onClick={() => setSnapEnabled(!snapEnabled)}
        />
{snapEnabled ? (
          <div className="flex items-center gap-1.5">
            <label className="hidden items-center gap-1 sm:flex">
              <span className="font-mono text-[10px] uppercase text-ink-faint">Move</span>
              <input
                type="number"
                step={0.05}
                min={0}
                value={translationSnap}
                data-testid="snap-translation"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 0) setSnaps({ translation: next });
                }}
                className="w-14 rounded-md border border-control bg-canvas px-1 py-0.5 font-mono text-[11px] tabular-nums text-ink outline-none focus:border-accent/60"
              />
            </label>
            <label className="hidden items-center gap-1 sm:flex">
              <span className="font-mono text-[10px] uppercase text-ink-faint">Rotate</span>
              <input
                type="number"
                step={5}
                min={0}
                value={rotationSnap}
                data-testid="snap-rotation"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 0) setSnaps({ rotation: next });
                }}
                className="w-14 rounded-md border border-control bg-canvas px-1 py-0.5 font-mono text-[11px] tabular-nums text-ink outline-none focus:border-accent/60"
              />
            </label>
            <label className="hidden items-center gap-1 lg:flex">
              <span className="font-mono text-[10px] uppercase text-ink-faint">Scale</span>
              <input
                type="number"
                step={0.05}
                min={0}
                value={scaleSnap}
                data-testid="snap-scale"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 0) setSnaps({ scale: next });
                }}
                className="w-14 rounded-md border border-control bg-canvas px-1 py-0.5 font-mono text-[11px] tabular-nums text-ink outline-none focus:border-accent/60"
              />
            </label>
          </div>
        ) : null}
      </div>

<ProjectMenu />
      <PrimitiveMenu />
    </div>
  );
}


