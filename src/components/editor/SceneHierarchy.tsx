import { useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useViewerStore } from '@/stores/useViewerStore';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import { buildSceneTree, type SceneNode } from '@/editor/sceneTree';

/**
 * Left panel: the scene hierarchy.
 *
 * Renders the serialisable tree from the editor store and mirrors selection
 * both ways. Rows are buttons so the whole hierarchy is keyboard reachable and
 * exposed as a list to assistive technology.
 */

function kindGlyph(kind: SceneNode['kind']): string {
  if (kind === 'skinnedMesh') return 'SK';
  if (kind === 'mesh') return 'ME';
  if (kind === 'bone') return 'BN';
  if (kind === 'group') return 'GR';
  return 'OB';
}

interface RowProps {
  node: SceneNode;
  depth: number;
}

function HierarchyRow({ node, depth }: RowProps) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const select = useEditorStore((s) => s.select);
  const setHovered = useEditorStore((s) => s.setHovered);

  const isSelected = selectedIds.includes(node.id);
  const isHovered = hoveredId === node.id;
  const isMesh = node.kind === 'mesh' || node.kind === 'skinnedMesh';

  const toggleVisible = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const working = getEditorWorkingScene();
      const object = working?.resolve(node.id);
      if (!working || !object) return;
      object.visible = !object.visible;
      // Rebuild so nested visibility stays consistent with the scene graph.
      useEditorStore.getState().setTree(buildSceneTree(working.root, working.registry));
      useEditorStore.getState().setModified(true);
    },
    [node.id],
  );

  return (
    <>
      <li>
        <div
          className={`flex items-center gap-1 rounded-md pr-1 transition-colors ${
            isSelected
              ? 'bg-accent-subtle text-accent'
              : isHovered
                ? 'bg-interactive text-ink'
                : 'text-ink-muted'
          }`}
          style={{ paddingLeft: `${depth * 10 + 2}px` }}
          onMouseEnter={() => setHovered(node.id)}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            type="button"
            onClick={(event) =>
              select(node.id, event.shiftKey || event.ctrlKey || event.metaKey)
            }
            disabled={!isMesh}
            aria-pressed={isSelected}
            data-testid={`hierarchy-row-${node.id}`}
            // A 32px minimum keeps the row comfortably tappable on touch screens.
            className="flex min-h-[32px] min-w-0 flex-1 items-center gap-1.5 rounded-md text-left focus-ring disabled:cursor-default"
          >
            <span className="shrink-0 font-mono text-[10px] leading-none text-ink-faint">
              {kindGlyph(node.kind)}
            </span>
            <span className="truncate text-xs leading-5">{node.label}</span>
            {node.duplicateName ? (
              <span
                className="shrink-0 font-mono text-[10px] leading-none text-ink-faint"
                title="Another object shares this name"
              >
                *
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={toggleVisible}
            aria-label={`${node.visible ? 'Hide' : 'Show'} ${node.label}`}
            aria-pressed={!node.visible}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-faint transition-colors hover:bg-interactive hover:text-ink focus-ring"
          >
            {node.visible ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="2.75" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path d="M4 4l16 16" />
                <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 3.9" />
                <path d="M6.3 8.1A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5" />
              </svg>
            )}
          </button>
        </div>
      </li>
      {node.children.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {node.children.map((child) => (
            <HierarchyRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function SceneHierarchy() {
  const tree = useEditorStore((s) => s.tree);
  const toggleHierarchy = useEditorStore((s) => s.toggleHierarchy);
  const isPlaying = useViewerStore((s) => s.isPlaying);

  return (
    <aside
      aria-label="Scene hierarchy"
      // The panel owns its scrolling so a long hierarchy can never expand the
      // workspace, and it inherits the column height on desktop.
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-b border-line bg-surface lg:w-full lg:border-b-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          Scene
        </h2>
        <button
          type="button"
          onClick={toggleHierarchy}
          aria-label="Collapse scene hierarchy"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-control text-ink-muted transition-colors hover:bg-interactive hover:text-ink focus-ring"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
        {tree && tree.length > 0 ? (
          <ul className="m-0 list-none space-y-0.5 p-0" data-testid="hierarchy-list">
            {tree.map((node) => (
              <HierarchyRow key={node.id} node={node} depth={0} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-3 text-xs text-ink-faint" data-testid="hierarchy-empty">
            {isPlaying ? 'Animating…' : 'No objects in this scene yet.'}
          </p>
        )}
      </div>
    </aside>
  );
}