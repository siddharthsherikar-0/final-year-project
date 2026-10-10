import { Mesh, Texture } from 'three';
import type { Material, Object3D } from 'three';
import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene } from '../editorRuntime';
import { buildSceneTree } from '../sceneTree';
import { clearHistory } from '../history/history';
import { restoreMaterials, serialiseWorkingScene } from './projectSerializer';
import {
  PROJECT_FORMAT_VERSION,
  validateProjectDocument,
  type ProjectDocument,
  type ProjectTexture,
} from './projectFormat';
import { listProjects, loadProject, saveProject, type ProjectSummary } from './projectStore';
import { buildPrimitiveGeometry, writePrimitiveMeta } from '../primitives';
import { setSlotMaterial } from '../materials';

/**
 * Project save / load.
 *
 * Saving serialises the LIVE scene rather than editor state, so what is restored
 * is what the user sees. Loading rebuilds the editable layer on top of the
 * source asset - the imported geometry, bones and original textures come from
 * the shared loader cache, and only the user's changes are reapplied. The
 * original uploaded asset is never overwritten or mutated.
 */

export interface SaveResult {
  ok: boolean;
  error?: string;
  projectId?: string;
}

/** Re-encodes a decoded texture into bytes that can be stored and reloaded. */
async function encodeTexture(texture: Texture): Promise<Blob | null> {
  const source = texture.image as
    | ImageBitmap
    | HTMLImageElement
    | HTMLCanvasElement
    | { width?: number; height?: number }
    | undefined;
  if (!source) return null;

  const width = (source as { width?: number }).width ?? 0;
  const height = (source as { height?: number }).height ?? 0;
  if (width === 0 || height === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(source as CanvasImageSource, 0, 0);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch {
    // A texture whose pixels cannot be read back (a GPU-only framebuffer, say)
    // is skipped rather than failing the whole save.
    return null;
  }
}

/** Builds the document for the current working scene. */
export async function captureProject(
  id: string,
  name: string,
  source: ProjectDocument['source'],
): Promise<ProjectDocument> {
  const working = getEditorWorkingScene();
  const now = Date.now();

  const base: ProjectDocument = {
    formatVersion: PROJECT_FORMAT_VERSION,
    id,
    name: name.trim() || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    source,
    materials: {},
    textures: {},
    nodes: [],
  };

  if (!working) return base;

  // Texture encoding is asynchronous, so the walker is given a synchroniser it
  // can call per texture; the keys it returns are what the document references.
  const pending: Promise<void>[] = [];
  const textures: Record<string, ProjectTexture> = {};

  const serialised = serialiseWorkingScene(working, (key, texture) => {
    pending.push(
      encodeTexture(texture).then((blob) => {
        if (!blob) return;
        const size = texture.image as { width?: number; height?: number } | undefined;
        textures[key] = {
          key,
          name: texture.name || `${key}.png`,
          width: size?.width ?? 0,
          height: size?.height ?? 0,
          colorSpace: texture.colorSpace,
          data: blob,
        };
      }),
    );
  });

  await Promise.all(pending);

  return {
    ...base,
    materials: serialised.materials,
    textures,
    nodes: serialised.nodes,
  };
}

/**
 * Rebuilds textures from a document.
 *
 * A texture that fails to decode resolves to null and the slot is simply left
 * empty, so one unreadable image cannot make an otherwise valid project
 * unopenable.
 */
async function restoreTextures(
  document: ProjectDocument,
): Promise<Map<string, Texture>> {
  const result = new Map<string, Texture>();

  await Promise.all(
    Object.values(document.textures ?? {}).map(async (record) => {
      try {
        const bitmap = await createImageBitmap(record.data);
        const texture = new Texture(bitmap);
        texture.name = record.name;
        texture.colorSpace = record.colorSpace as Texture['colorSpace'];
        texture.needsUpdate = true;
        result.set(record.key, texture);
      } catch {
        // Left unresolved; the slot stays empty rather than failing the load.
      }
    }),
  );

  return result;
}

/** Applies a restored document onto the current working scene. */
export async function applyProject(document: ProjectDocument): Promise<SaveResult> {
  const working = getEditorWorkingScene();
  if (!working) return { ok: false, error: 'Scene is not ready' };

  const textures = await restoreTextures(document);
  const materials = restoreMaterials(document.materials, {
    resolve: (key) => textures.get(key) ?? null,
  });

  // Rebuild the editable layer: existing imported nodes keep their geometry and
  // bones, while saved nodes (and the transforms on every node) are reapplied.
  const existing = new Map<string, Object3D>();
  working.root.traverse((object) => {
    const objectId = working.registry.idOf(object);
    if (objectId) existing.set(objectId, object);
  });

  const applyNode = (
    node: ProjectDocument['nodes'][number],
    parent: Object3D,
  ): Object3D | null => {
    let object = existing.get(node.id) ?? null;

    if (!object && node.primitive) {
      // A primitive that no longer exists (it was never created in this session)
      // is rebuilt from its stored parameters.
      try {
        const geometry = buildPrimitiveGeometry(node.primitive.kind, node.primitive.params);
        working.claimGeometry(geometry);
        const first = materials.values().next().value as Material | undefined;
        if (!first) return null;
        object = new Mesh(geometry, first);
        writePrimitiveMeta(object, node.primitive.kind, node.primitive.params);
        working.adoptObject(object, node.id);
      } catch {
        object = null;
      }
    }
    if (!object) return null;

    object.name = node.name;
    object.visible = node.visible;
    object.position.set(node.position[0], node.position[1], node.position[2]);
    object.quaternion.set(node.quaternion[0], node.quaternion[1], node.quaternion[2], node.quaternion[3]);
    object.scale.set(node.scale[0], node.scale[1], node.scale[2]);

    const mesh = object as unknown as { isMesh?: boolean; material?: Material | Material[] };
    if (mesh.isMesh && node.materials) {
      const slots = node.materials
        .map((record) => (record ? materials.get(record.key) ?? null : null))
        .filter((material): material is Material => material !== null);
      if (slots.length > 0) {
        setSlotMaterial(mesh as never, 0, slots[0] as Material);
        if (slots.length > 1) {
          (mesh as { material: Material | Material[] }).material = slots;
        }
      }
    }

    // Re-attach at the authored sibling position.
    parent.add(object);
    node.children.forEach((child) => applyNode(child, object as Object3D));
    return object;
  };

  // Detach everything the document does not mention, so a load shows exactly
  // what was saved rather than merging with the previous session's scene.
  const keep = new Set<string>();
  const collect = (nodes: ProjectDocument['nodes']): void => {
    nodes.forEach((node) => {
      keep.add(node.id);
      collect(node.children);
    });
  };
  collect(document.nodes);

  existing.forEach((object, objectId) => {
    if (keep.has(objectId)) return;
    if (object === working.root) return;
    object.removeFromParent();
  });

  document.nodes.forEach((node) => applyNode(node, working.root));

  useEditorStore.getState().setTree(buildSceneTree(working.root, working.registry));
  useEditorStore.getState().clearSelection();
  useEditorStore.getState().bumpGeometryEpoch();
  useEditorStore.getState().bumpMaterialEpoch();
  useEditorStore.getState().bumpTransformEpoch();
  useEditorStore.getState().setModified(false);
  // A reopened project starts with its own undo history: continuing to undo into
  // the previous session's steps would be meaningless and misleading.
  clearHistory();

  return { ok: true };
}

/** Saves the current scene, reusing `existingId` for Save and minting one for Save As. */
export async function saveProjectAction(
  name: string,
  existingId: string | null,
  source: ProjectDocument['source'],
): Promise<SaveResult> {
  try {
    const id = existingId ?? `project-${Date.now().toString(36)}`;
    const document = await captureProject(id, name, source);
    await saveProject(document);

    useEditorStore.getState().setProjectId(id);
    useEditorStore.getState().setProjectName(document.name);
    // Saving is the point at which the document becomes the clean baseline.
    useEditorStore.getState().setModified(false);
    return { ok: true, projectId: id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save the project',
    };
  }
}

/** Loads a stored project and applies it to the current scene. */
export async function openProjectAction(id: string): Promise<SaveResult> {
  const document = await loadProject(id);
  if (!document) return { ok: false, error: 'That project no longer exists' };

  const valid = validateProjectDocument(document);
  if (!valid.ok) return { ok: false, error: valid.error };

  const result = await applyProject(valid.value);
  if (!result.ok) return result;

  useEditorStore.getState().setProjectId(valid.value.id);
  useEditorStore.getState().setProjectName(valid.value.name);
  return { ok: true, projectId: valid.value.id };
}

/** Stored projects for the picker, newest first. */
export function listProjectSummaries(): Promise<ProjectSummary[]> {
  return listProjects();
}