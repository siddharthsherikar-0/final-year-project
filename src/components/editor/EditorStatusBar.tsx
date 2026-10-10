import { useMemo } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useViewerStore } from '@/stores/useViewerStore';
import { findSceneNode, flattenSceneNodes } from '@/editor/sceneTree';

/**
 * Bottom status strip.
 *
 * Reports the current selection and live scene statistics in one aligned line,
 * matching the Stage 8 status language instead of introducing a new one.
 */
export function EditorStatusBar() {
  const tree = useEditorStore((s) => s.tree);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const transformMode = useEditorStore((s) => s.transformMode);
  const isModified = useEditorStore((s) => s.isModified);
  const notice = useEditorStore((s) => s.notice);
  const viewStats = useViewerStore((s) => s.viewStats);

  const primaryLabel = useMemo(() => {
    const primaryId = selectedIds[0];
    if (!tree || !primaryId) return 'No selection';
    const node = findSceneNode(tree, primaryId);
    if (!node) return 'No selection';
    const suffix = selectedIds.length > 1 ? ` +${selectedIds.length - 1} more` : '';
    return `${node.label}${suffix}`;
  }, [tree, selectedIds]);

  const objectCount = useMemo(
    () => (tree ? flattenSceneNodes(tree).filter((node) => node.kind !== 'bone').length : 0),
    [tree],
  );

  return (
    <div
      className="flex min-h-[28px] shrink-0 items-center gap-3 overflow-x-auto border-t border-line bg-surface px-3"
      data-testid="editor-status"
    >
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
        {transformMode}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted" data-testid="status-selection">
        {primaryLabel}
      </span>
      {notice ? (
        <span
          className="min-w-0 shrink-0 truncate text-[11px] text-accent"
          data-testid="status-notice"
          role="status"
        >
          {notice}
        </span>
      ) : null}
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
        {objectCount} objects
        {viewStats ? ` · ${viewStats.triangles.toLocaleString('en-US')} tris` : ''}
        {viewStats ? ` · ${viewStats.calls} calls` : ''}
      </span>
      {isModified ? (
        <span
          className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-accent"
          data-testid="status-modified"
        >
          Modified
        </span>
      ) : null}
    </div>
  );
}