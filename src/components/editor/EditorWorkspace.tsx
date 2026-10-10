import type { ReactNode } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useViewerStore } from '@/stores/useViewerStore';
import { useIsEditorDesktop } from '@/hooks/useMediaQuery';

/**
 * Editor workspace shell.
 *
 * Sizing contract (this is what keeps the layout from breaking at small sizes
 * and short viewports):
 *
 *  - The shell is a fixed-height flex column: `h-full min-h-0`, and the row
 *    below the toolbar is `flex-1 min-h-0`. Neither may grow with content, so
 *    the workspace can never push the page taller than the viewport.
 *  - Both side columns are `min-h-0` + `overflow-hidden` wrappers whose HEIGHT
 *    is inherited from the row (`lg:h-full`) or capped on small screens. The
 *    panels inside own their own `overflow-y-auto`, so a long hierarchy scrolls
 *    INSIDE the panel instead of expanding the workspace.
 *  - The viewport column always keeps a usable minimum (`min-h-[38dvh]`) and
 *    grows to take whatever space the panels do not use.
 *
 * Panel strategy below desktop: the two side panels are MUTUALLY EXCLUSIVE.
 * Stacking a scene list, a viewport and an inspector in one phone column left
 * the model with under a third of the screen and pushed controls below the
 * fold, so on small screens opening one panel hides the other and the viewport
 * keeps the remaining height. Both are still reachable from the toolbar.
 *
 * The viewport is passed in as a node, which keeps the single existing
 * `<Canvas>` untouched: this component adds DOM chrome only.
 */
export function EditorWorkspace({
  toolbar,
  hierarchy,
  viewport,
  inspector,
  status,
}: {
  toolbar: ReactNode;
  hierarchy: ReactNode;
  viewport: ReactNode;
  inspector: ReactNode;
  status: ReactNode;
}) {
  const hierarchyOpen = useEditorStore((s) => s.hierarchyOpen);
  // The inspector column shares the Stage 8 panel flag so the page-level
  // "Inspection" toggle and the panel's own close button keep working.
  const inspectorOpen = useViewerStore((s) => s.panelOpen);
  const isDesktop = useIsEditorDesktop();

  const showHierarchy = hierarchyOpen && (isDesktop || !inspectorOpen);
  const showInspector = inspectorOpen;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-canvas">
      {toolbar}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Width is owned by the wrappers here so the panel fills them exactly;
            a duplicated width inside an identically sized box is what produces
            a spurious horizontal scrollbar once a scrollbar takes its space. */}
        {showHierarchy ? (
          <div className="flex min-h-0 max-h-[26dvh] shrink-0 flex-col overflow-hidden border-b border-line md:max-h-[28dvh] lg:h-full lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r xl:w-64">
            {hierarchy}
          </div>
        ) : null}

        <div className="flex min-h-[38dvh] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col">{viewport}</div>
          {status}
        </div>

        {showInspector ? (
          <div className="flex min-h-0 max-h-[44dvh] shrink-0 flex-col overflow-hidden border-t border-line bg-surface md:max-h-[34dvh] lg:h-full lg:max-h-none lg:w-72 lg:border-t-0 lg:border-l xl:w-80">
            {inspector}
          </div>
        ) : null}
      </div>
    </div>
  );
}

