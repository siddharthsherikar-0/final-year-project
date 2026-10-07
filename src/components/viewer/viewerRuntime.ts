import type { WebGLRenderer, Scene, PerspectiveCamera, Camera, Object3D } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface ViewerRuntime {
  gl: WebGLRenderer | null;
  scene: Scene | null;
  camera: PerspectiveCamera | null;
  controls: OrbitControlsImpl | null;
  modelRoot: Object3D | null;
}

export const viewerRuntime: ViewerRuntime = {
  gl: null,
  scene: null,
  camera: null,
  controls: null,
  modelRoot: null,
};

export function resetViewerRuntime(): void {
  viewerRuntime.gl = null;
  viewerRuntime.scene = null;
  viewerRuntime.camera = null;
  viewerRuntime.controls = null;
}

export type { Camera };
