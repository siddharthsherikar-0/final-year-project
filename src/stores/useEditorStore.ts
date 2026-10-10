import { create } from 'zustand';
import type { SceneNode } from '@/editor/sceneTree';

/**
 * Editor state.
 *
 * Holds ids and plain numbers only - never an `Object3D`. Live objects are
 * reached through `editorRuntime.workingScene.registry`.
 */

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'local' | 'world';

/** One recorded step, as the UI sees it. */
export interface HistoryEntryView {
  id: string;
  label: string;
  at: number;
}

export interface HistoryState {
  entries: HistoryEntryView[];
  canUndo: boolean;
  canRedo: boolean;
  /** Label of the step undo would revert, for the button tooltip. */
  undoLabel: string | null;
  /** Label of the step redo would re-apply. */
  redoLabel: string | null;
  limit: number;
}

const EMPTY_HISTORY: HistoryState = {
  entries: [],
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  limit: 100,
};

export interface EditorState {
  /** Selected object ids. Empty means nothing is selected. */
  selectedIds: string[];
  hoveredId: string | null;
  /** Serialisable hierarchy for the left panel. */
  tree: SceneNode[] | null;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  snapEnabled: boolean;
  translationSnap: number;
  rotationSnap: number;
  scaleSnap: number;
  /** Scene hierarchy column visibility. */
  hierarchyOpen: boolean;
  /** Primitive creation menu visibility. */
  primitiveMenuOpen: boolean;
  /**
   * Bumped whenever an object transform changed in the viewport, so numeric
   * inputs can re-read values without polling three every frame.
   */
  transformEpoch: number;
  /**
   * Bumped when geometry is created, regenerated, duplicated or deleted, so
   * panels that mirror live objects (geometry parameters, readouts) refresh.
   */
  geometryEpoch: number;
  /**
   * Stage 9B ships transforms only. Dirty tracking and real undo/redo are
   * Stage 9F; these placeholders exist so the toolbar does not have to change.
   */
  isModified: boolean;
  /**
   * Command history, in serialisable form.
   *
   * Only labels and counts live here - the operations themselves are plain data
   * held by the history module, and never a `Mesh`, `Material` or `Texture`.
   */
  history: HistoryState;
  setHistoryState: (history: HistoryState) => void;
  /**
   * Currently open project, or null for an unsaved session.
   *
   * `projectId` doubles as the Save As discriminator: a null id means Save must
   * mint a new one rather than silently overwriting whatever was open.
   */
  projectId: string | null;
  projectName: string | null;
  /** True while the scene holds edits that are not in the saved document. */
  isDirty: boolean;
  setProjectId: (id: string | null) => void;
  setProjectName: (name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  /** Short feedback line (operation result or refusal reason). */
  notice: string | null;

  setTree: (tree: SceneNode[] | null) => void;
  select: (id: string, additive?: boolean) => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  /** Drops ids that no longer resolve (deleted or model switched). */
  retainSelection: (liveIds: readonly string[]) => void;
  setHovered: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setTransformSpace: (space: TransformSpace) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnaps: (snaps: Partial<{ translation: number; rotation: number; scale: number }>) => void;
  toggleHierarchy: () => void;
  setPrimitiveMenuOpen: (open: boolean) => void;
  togglePrimitiveMenu: () => void;
/**
   * Bumped when an object transform changed in the viewport, so numeric
   * inputs can re-read values without polling three every frame.
   */
  bumpTransformEpoch: () => void;
  bumpGeometryEpoch: () => void;
  /**
   * Bumped on every material mutation (property write, assignment, reset,
   * texture swap). The material inspector derives its view model from the live
   * material, so this is the signal that its values must be re-read. Without
   * it a committed colour would only appear after an unrelated re-render.
   */
  materialEpoch: number;
  /**
   * Active material slot for the current selection. Multi-material meshes need
   * a slot to edit; this is an index, never a material reference.
   */
  activeMaterialSlot: number;
  /**
   * When true, a property write edits the SHARED material in place and affects
   * every object using it, instead of cloning copy-on-write for the selected
   * slot. Opt-in per session, default false (= edit selected only).
   */
  sharedMaterialEditing: boolean;
  setActiveMaterialSlot: (slot: number) => void;
  setSharedMaterialEditing: (shared: boolean) => void;
  bumpMaterialEpoch: () => void;
  setModified: (modified: boolean) => void;
  setNotice: (notice: string | null) => void;
  resetEditor: () => void;
}

const EMPTY_SELECTION: string[] = [];

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedIds: EMPTY_SELECTION,
  hoveredId: null,
  tree: null,
  transformMode: 'translate',
  transformSpace: 'world',
  snapEnabled: false,
  translationSnap: 0.25,
  rotationSnap: 15,
  scaleSnap: 0.1,
  hierarchyOpen: true,
  primitiveMenuOpen: false,
transformEpoch: 0,
  geometryEpoch: 0,
  materialEpoch: 0,
  activeMaterialSlot: 0,
  // Copy-on-write is the default: editing one object must never restyle the
  // others that happen to share its material.
  sharedMaterialEditing: false,
  isModified: false,
  notice: null,
  history: EMPTY_HISTORY,
  projectId: null,
  projectName: null,
  isDirty: false,

  setTree: (tree) => set({ tree }),

  select: (id, additive = false) => {
    if (!id) return;
    const current = get().selectedIds;
    if (!additive) {
      set({ selectedIds: [id] });
      return;
    }
    if (current.includes(id)) {
      // Shift-click on an already selected object removes it, matching the
      // convention of every mainstream editor.
      const next = current.filter((entry) => entry !== id);
      set({ selectedIds: next });
      return;
    }
    set({ selectedIds: [...current, id] });
  },

setSelection: (ids) =>
    // The material slot is per-mesh, so switching selection must reset it to a
    // valid index rather than carrying another mesh's slot across.
    set({
      selectedIds: ids.length === 0 ? EMPTY_SELECTION : [...new Set(ids)],
      activeMaterialSlot: 0,
    }),

  toggleSelection: (id) => {
    const current = get().selectedIds;
    set({
      selectedIds: current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    });
  },

  clearSelection: () => set({ selectedIds: EMPTY_SELECTION, hoveredId: null }),

  retainSelection: (liveIds) => {
    const live = new Set(liveIds);
    const current = get().selectedIds;
    const next = current.filter((id) => live.has(id));
    if (next.length === current.length) return;
    set({ selectedIds: next });
  },

  setHovered: (id) => set({ hoveredId: id }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setTransformSpace: (transformSpace) => set({ transformSpace }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setSnaps: (snaps) =>
    set({
      ...(snaps.translation !== undefined ? { translationSnap: snaps.translation } : {}),
      ...(snaps.rotation !== undefined ? { rotationSnap: snaps.rotation } : {}),
      ...(snaps.scale !== undefined ? { scaleSnap: snaps.scale } : {}),
    }),

  toggleHierarchy: () => set((s) => ({ hierarchyOpen: !s.hierarchyOpen })),

  setPrimitiveMenuOpen: (primitiveMenuOpen) => set({ primitiveMenuOpen }),
  togglePrimitiveMenu: () => set((s) => ({ primitiveMenuOpen: !s.primitiveMenuOpen })),
bumpTransformEpoch: () => set((s) => ({ transformEpoch: s.transformEpoch + 1 })),
  bumpGeometryEpoch: () => set((s) => ({ geometryEpoch: s.geometryEpoch + 1 })),
  bumpMaterialEpoch: () => set((s) => ({ materialEpoch: s.materialEpoch + 1 })),

  setActiveMaterialSlot: (activeMaterialSlot) =>
    set({ activeMaterialSlot: Number.isInteger(activeMaterialSlot) ? Math.max(0, activeMaterialSlot) : 0 }),
  setSharedMaterialEditing: (sharedMaterialEditing) => set({ sharedMaterialEditing }),
setModified: (isModified) => set({ isModified }),
  setNotice: (notice) => set({ notice }),
  setHistoryState: (history) => set({ history }),
  setProjectId: (projectId) => set({ projectId }),
  setProjectName: (projectName) => set({ projectName }),
  setDirty: (isDirty) => set({ isDirty }),

  resetEditor: () =>
    set({
      selectedIds: EMPTY_SELECTION,
      hoveredId: null,
      tree: null,
      transformMode: 'translate',
      transformSpace: 'world',
      snapEnabled: false,
      hierarchyOpen: true,
      primitiveMenuOpen: false,
transformEpoch: 0,
      geometryEpoch: 0,
      materialEpoch: 0,
      activeMaterialSlot: 0,
      sharedMaterialEditing: false,
      isModified: false,
      notice: null,
history: EMPTY_HISTORY,
      projectId: null,
      projectName: null,
      isDirty: false,
    }),
}));


