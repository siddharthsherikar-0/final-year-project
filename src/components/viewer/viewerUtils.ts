import { Box3, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import type { CameraPose, EnvironmentPreset } from '@/stores/useViewerStore';

export type LightformerForm = 'rect' | 'circle' | 'ring';

export interface LightformerSpec {
  form: LightformerForm;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  intensity: number;
}

export interface EnvironmentConfig {
  background: string;
  lightformers: LightformerSpec[];
}

const STUDIO_LIGHTFORMERS: LightformerSpec[] = [
  { form: 'rect', position: [0, 4, 4], scale: [6, 3, 1], color: '#ffffff', intensity: 3 },
  { form: 'rect', position: [-4, 1, -2], scale: [3, 4, 1], rotation: [0, Math.PI / 2, 0], color: '#e8ecff', intensity: 1.6 },
  { form: 'circle', position: [4, 2, -3], scale: [3, 3, 1], rotation: [0, -Math.PI / 3, 0], color: '#ffd9c2', intensity: 1.2 },
  { form: 'rect', position: [0, -3, 0], scale: [8, 8, 1], rotation: [Math.PI / 2, 0, 0], color: '#1d2230', intensity: 1 },
];

const MIDNIGHT_LIGHTFORMERS: LightformerSpec[] = [
  { form: 'rect', position: [0, 5, 2], scale: [7, 2, 1], color: '#7cc4ff', intensity: 2.4 },
  { form: 'ring', position: [-4, 2, -3], scale: [4, 4, 1], rotation: [0, Math.PI / 3, 0], color: '#4f7dff', intensity: 1.8 },
  { form: 'circle', position: [4, 0, 3], scale: [2, 2, 1], color: '#9fd8ff', intensity: 1.4 },
  { form: 'rect', position: [0, -4, 0], scale: [8, 8, 1], rotation: [Math.PI / 2, 0, 0], color: '#0b1020', intensity: 1 },
];

const SUNSET_LIGHTFORMERS: LightformerSpec[] = [
  { form: 'rect', position: [3, 3, 4], scale: [5, 3, 1], rotation: [0, -Math.PI / 5, 0], color: '#ffb27a', intensity: 3 },
  { form: 'circle', position: [-4, 1, -2], scale: [3, 3, 1], color: '#ff7a59', intensity: 1.8 },
  { form: 'ring', position: [0, 4, -4], scale: [4, 4, 1], rotation: [Math.PI / 3, 0, 0], color: '#ffd08a', intensity: 1.4 },
  { form: 'rect', position: [0, -4, 0], scale: [8, 8, 1], rotation: [Math.PI / 2, 0, 0], color: '#2a1410', intensity: 1 },
];

export const ENVIRONMENT_PRESETS: Record<EnvironmentPreset, EnvironmentConfig> = {
  studio: { background: '#101014', lightformers: STUDIO_LIGHTFORMERS },
  midnight: { background: '#070b16', lightformers: MIDNIGHT_LIGHTFORMERS },
  sunset: { background: '#1a0f0d', lightformers: SUNSET_LIGHTFORMERS },
};

export function framePose(
  box: Box3,
  fov: number,
  aspect: number,
  padding = 1.2,
): CameraPose | null {
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z) ||
    size.lengthSq() === 0
  ) {
    return null;
  }

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxSize / (2 * Math.tan((fov * Math.PI) / 360));
  const fitWidthDistance = fitHeightDistance / Math.max(aspect, 0.0001);
  const distance = padding * Math.max(fitHeightDistance, fitWidthDistance);

  const direction = new Vector3(1, 0.5, 1).normalize();
  const position = center.clone().add(direction.multiplyScalar(distance));

  return {
    position: [position.x, position.y, position.z],
    target: [center.x, center.y, center.z],
  };
}

export function zoomLevel(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
  minDistance: number,
  maxDistance: number,
): number {
  const distance = new Vector3(...position).distanceTo(new Vector3(...target));
  const safeMin = Math.max(minDistance, 0.0001);
  const safeMax = Math.max(maxDistance, safeMin * 1.0001);
  const raw = Math.log(distance / safeMin) / Math.log(safeMax / safeMin);
  return Math.min(1, Math.max(0, 1 - raw));
}

export function nextZoomPose(
  pose: CameraPose,
  factor: number,
  minDistance: number,
  maxDistance: number,
): CameraPose {
  const offset = new Vector3(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2],
  );
  let distance = offset.length();
  if (distance < 1e-6) {
    offset.set(0, 0, 1);
    distance = 1;
  }
  const clamped = Math.min(maxDistance, Math.max(minDistance, distance * factor));
  offset.setLength(clamped);
  return {
    position: [
      pose.target[0] + offset.x,
      pose.target[1] + offset.y,
      pose.target[2] + offset.z,
    ],
    target: pose.target,
  };
}

export interface ScreenshotTarget {
  gl: WebGLRenderer | null;
  scene: import('three').Scene | null;
  camera: import('three').PerspectiveCamera | null;
}

export function captureScreenshot(target: ScreenshotTarget): string | null {
  const { gl, scene, camera } = target;
  if (!gl || !scene || !camera) return null;
  try {
    gl.render(scene, camera);
    return gl.domElement.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function modelSlug(name: string, format: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'model';
  const ext = format.toLowerCase().replace(/[^a-z0-9]/g, '') || 'glb';
  return `${slug}-${Date.now()}.${ext}`;
}

export type ViewerAction =
  | 'reset'
  | 'frame'
  | 'zoomIn'
  | 'zoomOut'
  | 'autoRotate'
  | 'orbit'
  | 'grid'
  | 'axes'
  | 'wireframe'
  | 'background'
  | 'screenshot'
  | 'fullscreen'
  | 'help';

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: 'R', label: 'Reset camera' },
  { keys: 'F', label: 'Frame model' },
  { keys: '+ / -', label: 'Zoom in / out' },
  { keys: 'A', label: 'Auto-rotate' },
  { keys: 'O', label: 'Orbit (drag) on/off' },
  { keys: 'G', label: 'Grid' },
  { keys: 'X', label: 'Axes' },
  { keys: 'W', label: 'Wireframe' },
  { keys: 'B', label: 'Background' },
  { keys: 'S', label: 'Save screenshot' },
  { keys: 'Shift + F', label: 'Fullscreen' },
  { keys: '?', label: 'This help' },
];

const KEY_ACTIONS: Record<string, ViewerAction> = {
  r: 'reset',
  f: 'frame',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  a: 'autoRotate',
  o: 'orbit',
  g: 'grid',
  x: 'axes',
  w: 'wireframe',
  b: 'background',
  s: 'screenshot',
  '?': 'help',
};

export function shortcutAction(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): ViewerAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key === '?' || (event.shiftKey && event.key === '/')) return 'help';
  if (event.shiftKey && event.key.toLowerCase() === 'f') return 'fullscreen';
  return KEY_ACTIONS[event.key.toLowerCase()] ?? null;
}
