import { useEditorStore } from '@/stores/useEditorStore';
import { undo, redo } from './history';

/**
 * Undo/redo as editor commands.
 *
 * These sit alongside `editorCommands.ts` so the toolbar, the keyboard
 * shortcuts and any future menu all funnel through ONE place that also writes
 * the user-facing notice - a silent undo is disorienting, because the viewport
 * changes without anything saying why.
 */

/** Steps back one entry and reports what was reverted. */
export function undoAction(): boolean {
  const result = undo();
  useEditorStore.getState().setNotice(
    result.ok ? `Undid ${result.label ?? 'change'}` : (result.error ?? 'Nothing to undo'),
  );
  return result.ok;
}

/** Re-applies one entry and reports what was restored. */
export function redoAction(): boolean {
  const result = redo();
  useEditorStore.getState().setNotice(
    result.ok ? `Redid ${result.label ?? 'change'}` : (result.error ?? 'Nothing to redo'),
  );
  return result.ok;
}