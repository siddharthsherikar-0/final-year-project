import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Studio thumbnail renderer.
 *
 * Model cards must show the actual 3D asset, but the gallery must never hold a
 * live WebGL canvas per card (that would undo the Phase I context hardening).
 * Instead this module renders each asset ONCE into a plain image that is then
 * persisted and served like any other file.
 *
 * Design rules:
 * - exactly one WebGL context is created, lazily, and reused for every model
 * - the loaded asset is fully disposed after each render (geometries,
 *   materials, textures), and the renderer can be released explicitly
 * - framing is deterministic: same camera angle, same fov, same padding, so a
 *   grid of thumbnails looks like one consistent set of studio shots
 * - no interaction, no animation, no render loop: one render, one snapshot
 */

export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_HEIGHT = 480;
export const THUMBNAIL_MIME = 'image/jpeg';
export const THUMBNAIL_QUALITY = 0.86;

/** Studio backdrop, tuned to sit between --canvas and --elevated. */
const BACKDROP = 0x0b0d11;
/** Neutral key/fill/rim rig - no coloured lights, no glow. */
const LIGHT_INTENSITY = { key: 2.4, fill: 1.15, rim: 1.35, ambient: 1.45 };
const CAMERA_FOV = 32;
/** Extra room around the model so nothing touches the frame edge. */
const FRAME_PADDING = 1.12;
/**
 * Helper geometry (ground planes, backdrop quads, shadow cards) is often
 * included in a GLB and can be orders of magnitude larger than the asset
 * itself. Anything beyond this multiple of the median mesh size is excluded
 * from framing, otherwise the real model shrinks to a speck in the thumbnail.
 */
const HELPER_GEOMETRY_RATIO = 6;
/** Direction the camera sits in, relative to the model centre. */
const CAMERA_DIRECTION = new THREE.Vector3(0.85, 0.55, 1).normalize();

export type ThumbnailFailureReason =
  | 'webgl-unavailable'
  | 'load-failed'
  | 'empty-model'
  | 'render-failed'
  | 'timeout';

export class ThumbnailError extends Error {
  readonly reason: ThumbnailFailureReason;

  constructor(reason: ThumbnailFailureReason, message: string) {
    super(message);
    this.name = 'ThumbnailError';
    this.reason = reason;
  }
}

export interface ThumbnailResult {
  dataUrl: string;
  width: number;
  height: number;
}

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dracoLoader: DRACOLoader;
}

let studio: Studio | null = null;
let studioFailed = false;

/**
 * Creates (once) the offscreen studio. Returns null when the environment has no
 * WebGL support at all - callers fall back to the placeholder rather than
 * breaking the upload flow.
 */
function ensureStudio(): Studio | null {
  if (studio) return studio;
  if (studioFailed) return null;

  if (typeof document === 'undefined' || typeof WebGLRenderingContext === 'undefined') {
    studioFailed = true;
    return null;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      // Required so the canvas can be read back after a single render.
      preserveDrawingBuffer: true,
    });
  } catch {
    studioFailed = true;
    return null;
  }

  renderer.setPixelRatio(1);
  renderer.setSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, false);
  renderer.setClearColor(BACKDROP, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic tone mapping keeps dark and bright materials readable instead of
  // crushing near-black assets into an unreadable silhouette.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKDROP);

  // Studio rig: soft ambient bounce plus key/fill/rim, all neutral white.
  scene.add(
    new THREE.HemisphereLight(0xdfe4ec, 0x14171d, LIGHT_INTENSITY.ambient),
  );
  const key = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY.key);
  key.position.set(4, 6, 5);
  const fill = new THREE.DirectionalLight(0xd8dee9, LIGHT_INTENSITY.fill);
  fill.position.set(-5, 2, 3);
  const rim = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY.rim);
  rim.position.set(-2, 3, -5);
  scene.add(key, fill, rim);

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT,
    0.01,
    2000,
  );

  const dracoLoader = new DRACOLoader();
  // Same local decoder path as the viewer - never a CDN.
  dracoLoader.setDecoderPath('/draco/');
  dracoLoader.setDecoderConfig({ type: 'js' });

  studio = { renderer, scene, camera, dracoLoader };
  return studio;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(entry as unknown as Record<string, unknown>)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      entry.dispose();
    }
  });
}

function loadGltf(
  loader: GLTFLoader,
  url: string,
): Promise<{ scene: THREE.Group; dispose: () => void }> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, dispose: () => disposeObject(gltf.scene) }),
      undefined,
      () => reject(new ThumbnailError('load-failed', `Could not load ${url}`)),
    );
  });
}

/**
 * Bounding box of the model's real content.
 *
 * Per-mesh sizes are measured first so oversized helper geometry (ground
 * planes, backdrop quads, shadow cards) can be left out of the frame without
 * hiding it from the render.
 */
function contentBounds(root: THREE.Object3D): THREE.Box3 {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.visible && mesh.geometry) meshes.push(mesh);
  });

  const boxes = meshes
    .map((mesh) => {
      const box = new THREE.Box3().setFromObject(mesh);
      return box.isEmpty() ? null : box;
    })
    .filter((box): box is THREE.Box3 => box !== null);

  if (boxes.length === 0) return new THREE.Box3().setFromObject(root);

  const sizes = boxes
    .map((box) => box.getSize(new THREE.Vector3()).length())
    .sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const limit = median * HELPER_GEOMETRY_RATIO;

  const union = new THREE.Box3();
  let used = 0;
  for (const box of boxes) {
    if (median > 0 && box.getSize(new THREE.Vector3()).length() > limit) continue;
    union.union(box);
    used += 1;
  }

  // Every mesh looked like helper geometry - fall back to the full bounds.
  return used === 0 ? new THREE.Box3().setFromObject(root) : union;
}

/**
 * Positions the camera so the box exactly fills the frame from this angle.
 *
 * The eight box corners are projected into camera space and the distance is
 * solved per corner against both field-of-view axes. A conservative
 * bounding-sphere estimate would push flat or elongated assets far away and
 * shrink them to a speck in the thumbnail.
 */
function frameBox(camera: THREE.PerspectiveCamera, box: THREE.Box3): void {
  const center = box.getCenter(new THREE.Vector3());
  const min = box.min;
  const max = box.max;

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * camera.aspect;

  const direction = CAMERA_DIRECTION.clone().normalize();
  // Camera basis, so corner offsets can be expressed in view space.
  const forward = direction.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  let required = 0;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(center);
        const depth = offset.dot(forward);
        const lateralX = Math.abs(offset.dot(right));
        const lateralY = Math.abs(offset.dot(up));
        // Pull back far enough that this corner still sits inside the frustum.
        const needed = Math.max(lateralX / tanH, lateralY / tanV) + depth;
        required = Math.max(required, needed);
      }
    }
  }

  const distance = Math.max(required * FRAME_PADDING, 1e-3);
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = distance * 10;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

export interface GenerateThumbnailOptions {
  /** Milliseconds before the render is abandoned. */
  timeoutMs?: number;
}

/**
 * Renders one asset to a JPEG data URL.
 *
 * Rejects with a `ThumbnailError` (never a raw WebGL/loader exception) so the
 * caller can always fall back to the placeholder preview.
 */
export async function generateThumbnail(
  sourceUrl: string,
  options: GenerateThumbnailOptions = {},
): Promise<ThumbnailResult> {
  const active = ensureStudio();
  if (!active) {
    throw new ThumbnailError(
      'webgl-unavailable',
      'WebGL is unavailable, so no thumbnail can be rendered',
    );
  }

  const { renderer, scene, camera, dracoLoader } = active;
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  let asset: { scene: THREE.Group; dispose: () => void } | null = null;
  let timedOut = false;

  const run = (async (): Promise<ThumbnailResult> => {
    try {
      asset = await loadGltf(loader, sourceUrl);
    } catch (error) {
      if (error instanceof ThumbnailError) throw error;
      throw new ThumbnailError(
        'load-failed',
        error instanceof Error ? error.message : 'Could not load the model',
      );
    }

    const root = asset.scene;
    root.updateMatrixWorld(true);

    const box = contentBounds(root);
    if (box.isEmpty()) {
      throw new ThumbnailError('empty-model', 'The model has no visible geometry');
    }

    const size = box.getSize(new THREE.Vector3());
    if (box.getBoundingSphere(new THREE.Sphere()).radius <= 0 || size.length() <= 0) {
      throw new ThumbnailError('empty-model', 'The model has no visible geometry');
    }

    frameBox(camera, box);

    scene.add(root);
    try {
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL(THUMBNAIL_MIME, THUMBNAIL_QUALITY);
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        throw new ThumbnailError('render-failed', 'The canvas could not be encoded');
      }
      return { dataUrl, width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT };
    } catch (error) {
      if (error instanceof ThumbnailError) throw error;
      throw new ThumbnailError(
        'render-failed',
        error instanceof Error ? error.message : 'The model could not be rendered',
      );
    } finally {
      scene.remove(root);
      asset.dispose();
      asset = null;
    }
  })();

  const timeoutMs = options.timeoutMs ?? 20000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new ThumbnailError('timeout', 'Rendering the thumbnail timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run, timeout]);
  } catch (error) {
    // A timed-out render may still resolve later; make sure the scene does not
    // keep the half-loaded asset alive.
    if (timedOut) disposePendingAsset(scene);
    if (error instanceof ThumbnailError) throw error;
    throw new ThumbnailError(
      'render-failed',
      error instanceof Error ? error.message : 'The model could not be rendered',
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function disposePendingAsset(scene: THREE.Scene): void {
  for (let i = scene.children.length - 1; i >= 0; i -= 1) {
    const child = scene.children[i];
    if (child instanceof THREE.Group) {
      scene.remove(child);
      disposeObject(child);
    }
  }
}

/**
 * Renders an asset straight from a `File` (the upload flow).
 *
 * The temporary object URL is always revoked, including on failure, so a
 * cancelled upload cannot leak the blob.
 */
export async function generateThumbnailFromFile(
  file: File,
  options: GenerateThumbnailOptions = {},
): Promise<ThumbnailResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await generateThumbnail(objectUrl, options);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Releases the WebGL context. Call when the studio is no longer needed. */
export function disposeThumbnailRenderer(): void {
  if (!studio) return;
  disposePendingAsset(studio.scene);
  studio.dracoLoader.dispose();
  studio.renderer.dispose();
  studio.renderer.forceContextLoss();
  studio = null;
}

/** True while a WebGL studio is held open (used by tests and diagnostics). */
export function isThumbnailRendererActive(): boolean {
  return studio !== null;
}