import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { ToolbarButton } from './EditorPrimitives';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import {
  listProjectSummaries,
  openProjectAction,
  saveProjectAction,
} from '@/editor/projects/projectService';
import { exportAndDownload } from '@/editor/projects/glbExport';
import { isProjectStorageAvailable, deleteProject, type ProjectSummary } from '@/editor/projects/projectStore';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/**
 * Project save / load / export.
 *
 * Saving writes to browser-local IndexedDB (see `projectStore.ts` for why it is
 * not `localStorage`). The original uploaded asset is never touched: a project is
 * a separate document that references the source and layers edits over it.
 */

function formatSavedAt(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ProjectMenu() {
  const projectId = useEditorStore((s) => s.projectId);
  const projectName = useEditorStore((s) => s.projectName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setNotice = useEditorStore((s) => s.setNotice);

  // Mounted here because the toolbar is the component that owns the project
  // lifecycle, so the guard is installed exactly while an editing session exists.
  useUnsavedChangesGuard();

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /**
   * Panel placement, measured against the VIEWPORT rather than the button.
   *
   * The toolbar wraps, so the Project button sits at x=8 on some widths and
   * x=250 on others. Anchoring the panel to the button therefore overflowed one
   * way or the other depending on the width. Measuring the button's rect on open
   * and clamping the panel into the viewport keeps every control reachable at
   * every size.
   */
  const [placement, setPlacement] = useState<{ top: number; left: number; width: number } | null>(null);

  const MENU_WIDTH = 288;
  const MENU_GAP = 4;
  const MENU_MARGIN = 8;

  const measure = useCallback(() => {
    const button = document.querySelector('[data-testid="toolbar-project"]');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewport = window.innerWidth;
    const width = Math.min(MENU_WIDTH, viewport - MENU_MARGIN * 2);
    const preferred = rect.right - width;
    const left = Math.max(MENU_MARGIN, Math.min(preferred, viewport - width - MENU_MARGIN));
    setPlacement({ top: rect.bottom + MENU_GAP, left, width });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjectSummaries());
    } catch {
      setProjects([]);
    }
  }, []);

  // Loaded as the menu opens rather than in an effect that calls setState: the
  // list is only ever needed while the menu is visible.
  const toggle = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      if (next) {
        measure();
        void refresh();
      }
      return next;
    });
  }, [measure, refresh]);

  // Re-clamp on resize so a rotate or window resize cannot push the panel
  // off-screen while it is open.
  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const label = projectName ? projectName : 'Untitled';

  const runSave = async (asNew: boolean) => {
    const working = getEditorWorkingScene();
    if (!working) {
      setNotice('Scene is not ready');
      return;
    }
    const trimmed = name.trim() || label;
    setBusy(true);
    const result = await saveProjectAction(trimmed, asNew ? null : projectId, null);
    setBusy(false);
    if (result.ok) {
      setName('');
      setNotice(`Saved "${trimmed}"`);
      refresh();
    } else {
      setNotice(result.error ?? 'Could not save');
    }
  };

  const runOpen = async (id: string) => {
    setBusy(true);
    const result = await openProjectAction(id);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setNotice('Project opened');
    } else {
      setNotice(result.error ?? 'Could not open that project');
    }
  };

  const runDelete = async (id: string) => {
    await deleteProject(id);
    if (projectId === id) {
      useEditorStore.getState().setProjectId(null);
      useEditorStore.getState().setProjectName(null);
    }
    refresh();
  };

  const runExport = async () => {
    const working = getEditorWorkingScene();
    if (!working) {
      setNotice('Scene is not ready');
      return;
    }
    setBusy(true);
    const result = await exportAndDownload(working, label);
    setBusy(false);
    setNotice(
      result.ok
        ? `Exported ${result.fileName} (${Math.max(1, Math.round((result.byteLength ?? 0) / 1024))} KB)`
        : (result.error ?? 'Export failed'),
    );
  };

  const storageReady = isProjectStorageAvailable();

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <ToolbarButton
        label="Project"
        title="Save, open and export this project"
        active={open}
        pressed={open}
        onClick={toggle}
        testId="toolbar-project"
      >
        Project
        {isDirty ? (
          <span className="ml-1 text-accent" aria-label="Unsaved changes" title="Unsaved changes">
            •
          </span>
        ) : null}
      </ToolbarButton>

      {open ? (
        <div
          className="fixed z-50 rounded-lg border border-line bg-elevated p-3 shadow-panel"
          style={
            placement
              ? { top: placement.top, left: placement.left, width: placement.width }
              : { top: 96, left: 8, width: MENU_WIDTH }
          }
          role="dialog"
          aria-label="Project"
          data-testid="project-menu"
        >
          <p className="mb-2 text-xs text-ink-muted">
            Current: <span className="text-ink">{label}</span>
            {isDirty ? <span className="text-accent"> · unsaved</span> : null}
          </p>

          <label className="mb-2 block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">
              Project name
            </span>
            <input
              type="text"
              value={name}
              placeholder={label}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-control bg-canvas px-2 py-1.5 text-xs text-ink outline-none focus:border-accent/60"
              data-testid="project-name"
            />
          </label>

          <div className="mb-3 flex gap-1.5">
            <ToolbarButton
              label="Save"
              title={projectId ? 'Save over this project' : 'Save as a new project'}
              disabled={!storageReady || busy}
              onClick={() => runSave(false)}
              testId="project-save"
            />
            <ToolbarButton
              label="Save As"
              title="Save as a new project, keeping the current one"
              disabled={!storageReady || busy}
              onClick={() => runSave(true)}
              testId="project-save-as"
            />
            <ToolbarButton
              label="Export GLB"
              title="Download the edited scene as a GLB"
              disabled={busy}
              onClick={runExport}
              testId="project-export"
            />
          </div>

          {storageReady ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">
                Saved projects
              </p>
              {projects.length === 0 ? (
                <p className="px-1 py-2 text-xs text-ink-faint">Nothing saved yet.</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto" data-testid="project-list">
                  {projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-interactive"
                    >
                      <button
                        type="button"
                        onClick={() => runOpen(project.id)}
                        className="min-w-0 flex-1 truncate text-left text-xs text-ink"
                        title={`${project.name} · ${formatSavedAt(project.updatedAt)}`}
                      >
                        {project.name}
                        <span className="ml-1 text-ink-faint">
                          {project.nodeCount} obj · {formatSavedAt(project.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => runDelete(project.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-ink-faint hover:text-danger"
                        aria-label={`Delete ${project.name}`}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-faint">
              This browser cannot store projects locally.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}