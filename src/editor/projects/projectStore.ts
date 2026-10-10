import type { ProjectDocument } from './projectFormat';

/**
 * Browser-local project storage.
 *
 * ================================ WHY INDEXEDDB, NOT localStorage ================================
 * `localStorage` is a string store with a ~5 MB budget shared across the whole
 * origin. A single 4K PNG exceeds that before any of the other projects in this
 * origin are counted, and base64 would inflate every texture by a third on top.
 * IndexedDB stores structured data AND binary Blobs natively, so a texture is
 * written as decoded-image bytes and read back without any encoding round trip.
 *
 * The database is scoped to this origin only. It is deliberately NOT the server:
 * the studio's asset library is authenticated and server-owned, while these are
 * the user's unsaved working documents, which have no reason to leave the
 * machine that made them.
 * ===============================================================================================
 */

const DB_NAME = 'studio-projects';
const DB_VERSION = 1;
const STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

/** True when this environment can persist projects at all. */
export function isProjectStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Projects are listed newest-first, which is how the picker reads them.
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    // A blocked or failed open must not leave a rejected promise cached, or
    // every later call would fail for the life of the page.
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Could not open project storage'));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('Project storage is blocked by another tab'));
    };
  });

  return dbPromise;
}

function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Project storage request failed'));
      }),
  );
}

/** Lightweight summary for the project picker; omits the heavy payload. */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  nodeCount: number;
  textureCount: number;
}

/** Writes (or overwrites) a project. */
export async function saveProject(document: ProjectDocument): Promise<void> {
  if (!isProjectStorageAvailable()) {
    throw new Error('This browser cannot store projects locally');
  }
  await transaction('readwrite', (store) => store.put(document) as IDBRequest<IDBValidKey>);
}

/** Reads one project, or null when it no longer exists. */
export async function loadProject(id: string): Promise<ProjectDocument | null> {
  if (!isProjectStorageAvailable()) return null;
  const result = await transaction<ProjectDocument | undefined>(
    'readonly',
    (store) => store.get(id) as IDBRequest<ProjectDocument | undefined>,
  );
  return result ?? null;
}

/** Lists stored projects, newest first, without loading their payloads. */
export async function listProjects(): Promise<ProjectSummary[]> {
  if (!isProjectStorageAvailable()) return [];
  const all = await transaction<ProjectDocument[]>(
    'readonly',
    (store) => store.getAll() as IDBRequest<ProjectDocument[]>,
  );

  return all
    .map((document) => ({
      id: document.id,
      name: document.name,
      updatedAt: document.updatedAt,
      createdAt: document.createdAt,
      nodeCount: document.nodes?.length ?? 0,
      textureCount: Object.keys(document.textures ?? {}).length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Deletes one project. Missing ids are not an error. */
export async function deleteProject(id: string): Promise<void> {
  if (!isProjectStorageAvailable()) return;
  await transaction('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

/** Test seam: forgets every stored project. */
export async function clearAllProjects(): Promise<void> {
  if (!isProjectStorageAvailable()) return;
  await transaction('readwrite', (store) => store.clear() as IDBRequest<undefined>);
}