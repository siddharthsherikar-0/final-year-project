import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene, detachEditorTransformControls } from '../editorRuntime';
import { buildSceneTree } from '../sceneTree';
import type { WorkingScene } from '../workingScene';
import {
  applyOp,
  attachParked,
  detachObjects,
  invertOp,
  unparkSubtree,
  type ApplyResult,
  type EditorOp,
} from './operations';

/**
 * Command history.
 *
 * ================================ WHY A STACK, NOT A COMMAND LOG ================================
 * A log of "what happened" would have to re-derive intent at replay time, and a
 * delete of a rigged subtree cannot be re-derived at all. Instead each entry
 * stores a pair of operations: `undo` reverses, `redo` re-applies. Replay never
 * has to guess what the user meant.
 *
 * Entries hold plain data only (see `operations.ts`). Live three.js objects stay
 * in `editorRuntime` / the working scene and are resolved by id when an
 * operation applies.
 * ==============================================================================================
 */

/**
 * Default entry budget.
 *
 * Bounded on purpose: history is unbounded by nature, and every entry pins a
 * parked subtree plus its GPU resources until it is dropped, so a cap is the
 * only thing standing between a long session and unbounded memory.
 */
export const DEFAULT_HISTORY_LIMIT = 100;

/** Entries recorded within this window of each other merge when they match. */
const COALESCE_WINDOW_MS = 600;

export interface HistoryEntry {
  id: string;
  /** Short human label, shown in the status bar and the toolbar tooltips. */
  label: string;
  op: EditorOp;
  /**
   * Key used to merge consecutive entries - a gizmo drag emits many transform
   * operations that must collapse into ONE undo step, while two deliberate moves
   * of the same object must stay separate.
   */
  coalesceKey: string | null;
  /**
   * Where a structural step parked its subtree, learned when the step ran.
   *
   * This is runtime state rather than recorded intent, which is why it lives on
   * the entry and not inside the serialisable operation.
   */
  parkedId: string | null;
  at: number;
}

export interface HistorySnapshot {
  /** Bounded, oldest-first. */
  entries: HistoryEntry[];
  undoLabel: string | null;
  redoLabel: string | null;
  limit: number;
}

interface HistoryRuntime {
  entries: HistoryEntry[];
  /** Index of the next entry REDO would apply. `entries.length` means nothing to redo. */
  cursor: number;
  limit: number;
  counter: number;
}

const runtime: HistoryRuntime = {
  entries: [],
  cursor: 0,
  limit: DEFAULT_HISTORY_LIMIT,
  counter: 0,
};

function nextId(): string {
  runtime.counter += 1;
  return `h${runtime.counter}`;
}

/** Publishes the serialisable view of history into the store. */
function publish(): void {
  const last = runtime.entries[runtime.cursor - 1] ?? null;
  const next = runtime.entries[runtime.cursor] ?? null;
  useEditorStore.getState().setHistoryState({
    entries: runtime.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      at: entry.at,
    })),
    canUndo: runtime.cursor > 0,
    canRedo: runtime.cursor < runtime.entries.length,
    undoLabel: last ? last.label : null,
    redoLabel: next ? next.label : null,
    limit: runtime.limit,
  });
}

/**
 * Drops entries the redo branch owned.
 *
 * Recording after an undo discards the abandoned future - that is what makes
 * redo predictable rather than a source of surprise.
 */
function truncateRedoBranch(): void {
  if (runtime.cursor >= runtime.entries.length) return;
  const dropped = runtime.entries.slice(runtime.cursor);
  runtime.entries = runtime.entries.slice(0, runtime.cursor);
  dropped.forEach((entry) => releaseEntryResources(entry));
}

/** Frees whatever an entry was pinning once it leaves the history. */
function releaseEntryResources(entry: HistoryEntry): void {
  if (entry.parkedId) unparkSubtree(entry.parkedId);
}

/**
 * Records an operation as the newest undo step.
 *
 * `label` is what the user reads ("Move Cube", "Base colour updated"); `op` is
 * the forward effect, whose inverse is derived automatically.
 */
export function recordHistory(
  op: EditorOp,
  label: string,
  coalesceKey: string | null = null,
  parkedId: string | null = null,
): void {
  if (!op) return;

  truncateRedoBranch();

  const at = Date.now();
  const previous = runtime.entries[runtime.entries.length - 1];

  // A gizmo drag fires `objectChange` continuously but must produce ONE step.
  // Merging keeps the ORIGINAL `before` state so undo still lands where the drag
  // started, not where the previous frame was.
  if (
    coalesceKey !== null &&
    previous &&
    previous.coalesceKey === coalesceKey &&
    at - previous.at <= COALESCE_WINDOW_MS
  ) {
    previous.at = at;
    previous.op = mergeOps(previous.op, op);
    publish();
    return;
  }

  runtime.entries.push({ id: nextId(), label, op, coalesceKey, parkedId, at });
  runtime.cursor = runtime.entries.length;

  // Enforce the bound by dropping the OLDEST entry, which is the one least
  // likely to be wanted and the only one whose resources can be freed.
  while (runtime.entries.length > runtime.limit) {
    const dropped = runtime.entries.shift();
    if (!dropped) break;
    releaseEntryResources(dropped);
    runtime.cursor = Math.max(0, runtime.cursor - 1);
  }

  publish();
}

/**
 * Folds a newer operation into an older one, preserving the older `before`.
 *
 * Merging is only defined for operations that address the same subject AND
 * carry a `before` to carry forward; anything else would silently drop an edit,
 * so the newer operation is kept as a separate entry instead.
 */
function mergeOps(older: EditorOp, newer: EditorOp): EditorOp {
  const candidate = older as { before?: unknown };
  if (!('before' in candidate)) return newer;
  // Structural operations are never merged: each one owns a parked subtree or a
  // freshly created node, and folding them would strand that state.
  if (['createObject', 'duplicate', 'delete', 'group', 'ungroup'].includes(older.kind)) {
    return newer;
  }
  if (
    older.kind !== newer.kind ||
    JSON.stringify({ ...older, before: undefined }) !==
      JSON.stringify({ ...newer, before: undefined })
  ) {
    return newer;
  }
  return { ...newer, before: candidate.before } as EditorOp;
}

/** Rebuilds the serialisable panels after an operation applied. */
function refresh(working: WorkingScene | null): void {
  const store = useEditorStore.getState();
  store.setTree(working ? buildSceneTree(working.root, working.registry) : null);
  // An undo can remove the object the selection pointed at. Dropping dead ids
  // here keeps the panels, the outline and the gizmo from addressing an object
  // that is no longer in the scene.
  if (working) store.retainSelection(working.registry.ids());
  store.bumpTransformEpoch();
  store.bumpGeometryEpoch();
  store.bumpMaterialEpoch();
  store.setModified(true);
  store.setDirty(true);
  publish();
}

export interface HistoryResult {
  ok: boolean;
  error?: string;
  label?: string;
}

/**
 * Applies one entry's BACKWARD effect.
 *
 * Structural steps are handled here rather than through `invertOp` because
 * their inverse depends on runtime state that does not exist at record time -
 * a parked subtree, a node that must be recreated under a specific id.
 */
function runUndo(entry: HistoryEntry, working: WorkingScene): ApplyResult {
  const op = entry.op;

  // Creating an object, or duplicating one, is undone by REMOVING what was made.
  if (op.kind === 'createObject' || op.kind === 'duplicate') {
    const targetId = op.kind === 'createObject' ? op.objectId : op.createdId;
    // The gizmo is very likely attached to the object being removed (creation
    // selects it). Detach first, or three renders one frame with the controls
    // pointing at a detached node.
    detachEditorTransformControls();
    const outcome = detachObjects(working, [targetId]);
    entry.parkedId = outcome.parkedId;
    if (outcome.detached.length === 0) {
      return { ok: false, error: outcome.refused[0]?.reason ?? 'Nothing to undo' };
    }
    return { ok: true };
  }

  // Deleting is undone by re-attaching the nodes that were parked.
  if (op.kind === 'delete') {
    if (!entry.parkedId) return { ok: false, error: 'That object is no longer recoverable' };
    const result = attachParked(working, entry.parkedId);
    if (!result.ok) return result;
    // The subtree is back in the graph, so the parking slot is spent.
    entry.parkedId = null;
    return result;
  }

  const inverse = invertOp(op);
  if (!inverse) return { ok: false, error: 'That step cannot be undone' };
  return applyOp(working, inverse);
}

/** Applies one entry's FORWARD effect. */
function runRedo(entry: HistoryEntry, working: WorkingScene): ApplyResult {
  const op = entry.op;

  // Re-deleting parks the subtree again, under a fresh id.
  if (op.kind === 'delete') {
    const outcome = detachObjects(working, op.objectIds);
    entry.parkedId = outcome.parkedId;
    if (outcome.detached.length === 0) {
      return { ok: false, error: outcome.refused[0]?.reason ?? 'Nothing to redo' };
    }
    return { ok: true, refused: outcome.refused };
  }

  return applyOp(working, op);
}

/**
 * Applies one step backwards.
 *
 * Returns the entry's label so the caller can put it in the status notice,
 * which is how the user learns what they just undid.
 */
export function undo(): HistoryResult {
  if (runtime.cursor === 0) return { ok: false, error: 'Nothing to undo' };

  const entry = runtime.entries[runtime.cursor - 1];
  if (!entry) return { ok: false, error: 'Nothing to undo' };
  const working = getEditorWorkingScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const result = runUndo(entry, working);
  if (!result.ok) return { ok: false, error: result.error };

  runtime.cursor -= 1;
  applySelection(result.selection);
  refresh(working);
  return { ok: true, label: entry.label };
}

/** Re-applies the step the cursor currently sits in front of. */
export function redo(): HistoryResult {
  if (runtime.cursor >= runtime.entries.length) return { ok: false, error: 'Nothing to redo' };

  const entry = runtime.entries[runtime.cursor];
  if (!entry) return { ok: false, error: 'Nothing to redo' };
  const working = getEditorWorkingScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const result = runRedo(entry, working);
  if (!result.ok) return { ok: false, error: result.error };

  runtime.cursor += 1;
  applySelection(result.selection);
  refresh(working);
  return { ok: true, label: entry.label };
}

/** Drops ids that no longer resolve after a structural replay. */
function applySelection(selection: string[] | undefined): void {
  if (!selection || selection.length === 0) return;
  const working = getEditorWorkingScene();
  if (!working) return;
  useEditorStore.getState().setSelection(selection.filter((id) => working.registry.has(id)));
}

/** Clears every step. Called when the working scene is replaced. */
export function clearHistory(): void {
  runtime.entries.forEach(releaseEntryResources);
  runtime.entries = [];
  runtime.cursor = 0;
  publish();
}

/** Changes the entry budget, trimming the oldest entries if needed. */
export function setHistoryLimit(limit: number): void {
  const safe = Math.max(1, Math.floor(limit));
  runtime.limit = safe;
  while (runtime.entries.length > runtime.limit) {
    const dropped = runtime.entries.shift();
    if (!dropped) break;
    releaseEntryResources(dropped);
    runtime.cursor = Math.max(0, runtime.cursor - 1);
  }
  publish();
}

/** Current history state, for tests. */
export function getHistoryState(): HistorySnapshot {
  return {
    entries: runtime.entries,
    undoLabel: (runtime.entries[runtime.cursor - 1] ?? null)?.label ?? null,
    redoLabel: (runtime.entries[runtime.cursor] ?? null)?.label ?? null,
    limit: runtime.limit,
  };
}

/** Test seam: the recorded entry count without touching the store. */
export function historyLength(): number {
  return runtime.entries.length;
}