import type { Object3D } from 'three';

/**
 * Editor object identity.
 *
 * The editor never stores `Object3D` references in React or Zustand state: it
 * stores opaque string ids and resolves them through a registry that lives
 * outside the render tree. That keeps editor state serialisable and makes a
 * stale id a *miss* rather than a reference to a disposed object.
 *
 * Ids are namespaced per working scene (`<prefix>-<n>`), so an id from a
 * previous model can never accidentally resolve against the current scene -
 * which is what makes stale selection safe.
 */
export class ObjectRegistry {
  private readonly byId = new Map<string, Object3D>();
  private readonly idByObject = new WeakMap<Object3D, string>();
  private counter = 0;

  constructor(private readonly prefix: string) {}

  /**
   * Registers an object and returns its stable editor id.
   *
   * Re-registering an object that already has an id RESTORES that id rather than
   * minting a new one. This matters for undo: a deleted object keeps its id (the
   * id is part of the delete history record), so undoing a delete must make the
   * very same id resolve again. Without restoring the `byId` entry, `resolve`
   * would keep returning null and the restored object would be unreachable.
   */
  register(object: Object3D): string {
    const existing = this.idByObject.get(object);
    if (existing) {
      this.byId.set(existing, object);
      return existing;
    }

    this.counter += 1;
    const id = `${this.prefix}-${this.counter}`;
    this.byId.set(id, object);
    this.idByObject.set(object, id);
    return id;
  }

  /**
   * Binds `object` to a caller-supplied id.
   *
   * Used when restoring a subtree whose ids were captured earlier (undo of a
   * delete). Rejects an id already bound to a DIFFERENT object, which would
   * otherwise silently make one of the two unreachable.
   */
  registerAs(object: Object3D, id: string): string {
    const holder = this.byId.get(id);
    if (holder && holder !== object) return this.register(object);

    this.byId.set(id, object);
    this.idByObject.set(object, id);
    const match = /^(\w+)-(\d+)$/.exec(id);
    if (match && match[1] === this.prefix) {
      const numeric = Number(match[2]);
      if (Number.isFinite(numeric) && numeric > this.counter) this.counter = numeric;
    }
    return id;
  }

  /** Returns the object for an id, or null when unknown or already cleared. */
  resolve(id: string | null | undefined): Object3D | null {
    if (!id) return null;
    return this.byId.get(id) ?? null;
  }

  /** Returns the id for an object, or null when it was never registered. */
  idOf(object: Object3D | null | undefined): string | null {
    if (!object) return null;
    return this.idByObject.get(object) ?? null;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Removes one registration.
   *
   * Used when an object is deleted so its id stops resolving immediately, even
   * though the object graph may still hold unrelated nodes. Returns the object
   * that was registered, or null.
   */
  unregister(id: string): Object3D | null {
    const object = this.byId.get(id) ?? null;
    if (object) this.byId.delete(id);
    return object;
  }

  get size(): number {
    return this.byId.size;
  }

  /** Ids of every currently registered object. */
  ids(): string[] {
    return [...this.byId.keys()];
  }

  /**
   * Drops registrations for objects no longer reachable from `root`.
   *
   * Deleted, reparented-away and disposed objects therefore stop resolving, so
   * a selection that outlives its object becomes a harmless miss instead of a
   * dangling reference. Returns the ids that were dropped.
   */
  prune(root: Object3D): string[] {
    const reachable = new Set<string>();
    root.traverse((object) => {
      const id = this.idByObject.get(object);
      if (id) reachable.add(id);
    });

    const dropped: string[] = [];
    for (const id of [...this.byId.keys()]) {
      if (reachable.has(id)) continue;
      this.byId.delete(id);
      dropped.push(id);
    }
    return dropped;
  }

  /** Drops every registration. Ids stop resolving immediately. */
  clear(): void {
    this.byId.clear();
    // `idByObject` is a WeakMap keyed by objects we no longer reference, so it
    // needs no explicit reset; entries vanish with their objects.
  }
}

/** Builds a prefix that cannot collide with another working scene's prefix. */
export function createIdPrefix(): string {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `e${globalCrypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  }
  // Deterministic fallback for environments without WebCrypto (older jsdom).
  ObjectRegistryCounter.bump();
  return `e${ObjectRegistryCounter.value.toString(36)}`;
}

const ObjectRegistryCounter = {
  value: 0,
  bump() {
    this.value += 1;
  },
};