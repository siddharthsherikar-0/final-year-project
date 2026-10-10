import { Group } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Object3D } from 'three';
import type { WorkingScene } from '../workingScene';
import { safeFileName } from './projectFormat';

/**
 * GLB export.
 *
 * ================================ WHY THE SCENE IS CLONED ================================
 * `GLTFExporter.parse` walks the graph and reads geometry, materials and skins.
 * Handing it the LIVE working scene risks two real failures:
 *
 *   1. The selection outline is a `LineSegments` added to the selected mesh. It
 *      would be exported as geometry the user never made, and it carries the
 *      editor's accent colour.
 *   2. Exporting must not mutate or dispose the scene it reads. A user's unsaved
 *      work must survive an export untouched.
 *
 * So the export runs against a `SkeletonUtils.clone` (which rebinds skinned
 * meshes to cloned bones, preserving the rig) with editor helpers stripped. The
 * working scene is only ever READ.
 *
 * ================================ WHY THE EXPORTER IS LAZY ================================
 * `GLTFExporter` plus the animation helpers it pulls in is ~60 kB. Most sessions
 * never export, so it is loaded on first use rather than shipped in the viewer
 * chunk - the same rule the viewer already follows for `GLTFLoader`.
 * ===========================================================================================
 */

/** Minimal structural type for the exporter, so three's full types stay out. */
type GLTFExporterLike = {
  parse: (
    input: Object3D,
    onDone: (result: ArrayBuffer | Record<string, unknown>) => void,
    onError: (error: unknown) => void,
    options?: { binary?: boolean; onlyVisible?: boolean },
  ) => void;
};

let exporterPromise: Promise<GLTFExporterLike> | null = null;

/** Loads the exporter once and reuses it for later exports. */
function loadExporter(): Promise<GLTFExporterLike> {
  if (!exporterPromise) {
    exporterPromise = import('three/examples/jsm/exporters/GLTFExporter.js').then((module) => {
      const Constructor = (module as { GLTFExporter: new () => GLTFExporterLike }).GLTFExporter;
      return new Constructor();
    });
  }
  return exporterPromise;
}

/** Test seam: drops the cached exporter so a later export reloads it. */
export function resetExporterCache(): void {
  exporterPromise = null;
}

/** Marks editor-only helper objects so they can be excluded from an export. */
const EDITOR_HELPER_KEY = '__studioEditorHelper';

function isEditorHelper(object: Object3D): boolean {
  const bag = object as unknown as Record<string, unknown>;
  // Line objects are the selection outline and any import-time wireframe aid;
  // neither is model geometry the user asked to export.
  return (
    bag[EDITOR_HELPER_KEY] === true ||
    bag.isLine === true ||
    bag.isLineSegments === true ||
    bag.isLineLoop === true
  );
}

/**
 * Builds a detached copy of the scene suitable for export.
 *
 * Exported for tests so the clone can be inspected without running the exporter.
 */
export function buildExportRoot(working: WorkingScene): Group {
  // SkeletonUtils is already in the viewer chunk (the working scene is built
  // with it), so reusing it costs nothing extra.
  const root = cloneSkeleton(working.root) as Group;
  root.name = working.root.name || 'Scene';

  // Strip helpers from the CLONE only; the live scene keeps its outline.
  const doomed: Object3D[] = [];
  root.traverse((object) => {
    if (object !== root && isEditorHelper(object)) doomed.push(object);
  });
  doomed.forEach((object) => object.removeFromParent());

  // Editor bookkeeping (primitive parameters, group insert slots) is not part of
  // the model the user wants to export, so it is not carried across.
  const strip = (object: Object3D): void => {
    object.userData = {};
  };
  root.traverse(strip);

  return root;
}

/** Tags an object as an editor helper that must never reach an export. */
export function markEditorHelper(object: Object3D): void {
  (object as unknown as Record<string, unknown>)[EDITOR_HELPER_KEY] = true;
}

export interface ExportResult {
  ok: boolean;
  error?: string;
  blob?: Blob;
  fileName?: string;
  byteLength?: number;
}

/** Serialises the working scene to a binary GLB. */
export async function exportSceneToGlb(
  working: WorkingScene,
  projectName: string,
): Promise<ExportResult> {
  let root: Group;
  try {
    root = buildExportRoot(working);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not prepare the scene for export',
    };
  }

  let exporter: GLTFExporterLike;
  try {
    exporter = await loadExporter();
  } catch {
    return { ok: false, error: 'Could not load the GLB exporter' };
  }

  return new Promise((resolve) => {
    exporter.parse(
      root,
      (result) => {
        try {
          // Binary output arrives as an ArrayBuffer; anything else means the
          // exporter fell back to JSON, which is not what "export GLB" promises.
          if (!(result instanceof ArrayBuffer)) {
            resolve({ ok: false, error: 'The exporter did not produce a binary GLB' });
            return;
          }
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          resolve({
            ok: true,
            blob,
            fileName: safeFileName(projectName, '.glb'),
            byteLength: blob.size,
          });
        } catch (error) {
          resolve({
            ok: false,
            error: error instanceof Error ? error.message : 'Could not package the exported model',
          });
        }
      },
      (error) => {
        resolve({
          ok: false,
          error: error instanceof Error ? error.message : 'Could not export the scene',
        });
      },
      { binary: true, onlyVisible: false },
    );
  });
}

/**
 * Hands a blob to the browser as a download.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari and
 * some Chrome builds have not started the download when `click()` returns, and
 * revoking synchronously cancels it. This is the one place the URL outlives its
 * creator, and it is always released.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Exports and, on success, downloads in one step. */
export async function exportAndDownload(
  working: WorkingScene,
  projectName: string,
): Promise<ExportResult> {
  const result = await exportSceneToGlb(working, projectName);
  if (!result.ok || !result.blob || !result.fileName) return result;

  downloadBlob(result.blob, result.fileName);
  return result;
}