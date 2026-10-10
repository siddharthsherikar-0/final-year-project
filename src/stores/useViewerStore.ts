import { create } from 'zustand';
import type { SceneInspection } from '@/utils/sceneInspection';

export type EnvironmentPreset = 'studio' | 'midnight' | 'sunset';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

const ENVIRONMENT_ORDER: EnvironmentPreset[] = ['studio', 'midnight', 'sunset'];
const DEFAULT_POSITION: [number, number, number] = [0, 1, 5];
const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

interface ViewerState {
  cameraPosition: [number, number, number];
  controlsTarget: [number, number, number];
  lastFrame: CameraPose | null;
  isWireframe: boolean;
  autoRotate: boolean;
  showGrid: boolean;
  showAxes: boolean;
  orbitEnabled: boolean;
  environment: EnvironmentPreset;
  animationClips: string[];
  activeClip: number;
  isPlaying: boolean;
  viewStats: { triangles: number; calls: number } | null;
  /** Inspection panel visibility. Shared so the dock, the toolbar and the
   *  panel itself can never disagree about whether it is open. */
  panelOpen: boolean;
  /** Serializable description of the loaded scene (null until it is ready). */
  sceneInspection: SceneInspection | null;
  /** Which model the studio state currently belongs to. */
  studioModelId: string | null;
  setCameraPosition: (pos: [number, number, number]) => void;
  setCameraPose: (pose: CameraPose) => void;
  resetCamera: () => void;
  setLastFrame: (pose: CameraPose | null) => void;
  applyLastFrame: () => void;
  toggleWireframe: () => void;
  toggleAutoRotate: () => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleOrbit: () => void;
  cycleEnvironment: () => void;
  setEnvironment: (preset: EnvironmentPreset) => void;
  setAnimationClips: (clips: string[]) => void;
  setActiveClip: (index: number) => void;
  togglePlaying: () => void;
  setViewStats: (stats: { triangles: number; calls: number }) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setSceneInspection: (inspection: SceneInspection | null) => void;
  /**
   * Returns every studio-scoped slice to its default so one model's camera,
   * view toggles, environment and panel state cannot leak into the next model.
   */
  resetStudioState: () => void;
  /**
   * Resets the studio state when it belongs to a different model. Safe to call
   * on every visit: revisiting the same model keeps its state (opening the
   * same asset again should not silently move the camera), while switching to
   * another model always starts clean.
   */
  ensureStudioFor: (modelId: string) => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  cameraPosition: DEFAULT_POSITION,
  controlsTarget: DEFAULT_TARGET,
  lastFrame: null,
  isWireframe: false,
  autoRotate: false,
  showGrid: true,
  showAxes: false,
  orbitEnabled: true,
  environment: 'studio',
  animationClips: [],
  activeClip: 0,
  isPlaying: false,
  viewStats: null,
    panelOpen: false,
  sceneInspection: null,
  studioModelId: null,

  setCameraPosition: (pos) => set({ cameraPosition: pos }),

  setCameraPose: (pose) =>
    set({ cameraPosition: pose.position, controlsTarget: pose.target }),

  resetCamera: () =>
    set({
      cameraPosition: [...DEFAULT_POSITION] as [number, number, number],
      controlsTarget: [...DEFAULT_TARGET] as [number, number, number],
    }),

  setLastFrame: (pose) => set({ lastFrame: pose }),

  applyLastFrame: () => {
    const pose = get().lastFrame;
    if (pose) get().setCameraPose(pose);
  },

  toggleWireframe: () => set((s) => ({ isWireframe: !s.isWireframe })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleOrbit: () => set((s) => ({ orbitEnabled: !s.orbitEnabled })),

  cycleEnvironment: () =>
    set((s) => {
      const index = ENVIRONMENT_ORDER.indexOf(s.environment);
      const next = ENVIRONMENT_ORDER[(index + 1) % ENVIRONMENT_ORDER.length];
      return { environment: next };
    }),

  setEnvironment: (preset) => set({ environment: preset }),

  setAnimationClips: (clips) =>
    set({ animationClips: clips, activeClip: 0, isPlaying: false }),

  setActiveClip: (index) =>
    set((s) => ({
      activeClip: Math.max(0, Math.min(index, Math.max(0, s.animationClips.length - 1))),
    })),

  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setViewStats: (stats) => set({ viewStats: stats }),

  setPanelOpen: (open) => set({ panelOpen: open }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  setSceneInspection: (inspection) => set({ sceneInspection: inspection }),

  resetStudioState: () =>
    set({
      cameraPosition: [...DEFAULT_POSITION] as [number, number, number],
      controlsTarget: [...DEFAULT_TARGET] as [number, number, number],
      lastFrame: null,
      isWireframe: false,
      autoRotate: false,
      showGrid: true,
      showAxes: false,
      orbitEnabled: true,
      environment: 'studio',
      animationClips: [],
      activeClip: 0,
      isPlaying: false,
      viewStats: null,
      panelOpen: false,
      sceneInspection: null,
    }),

  ensureStudioFor: (modelId) => {
    if (get().studioModelId === modelId) return;
    set({
      cameraPosition: [...DEFAULT_POSITION] as [number, number, number],
      controlsTarget: [...DEFAULT_TARGET] as [number, number, number],
      lastFrame: null,
      isWireframe: false,
      autoRotate: false,
      showGrid: true,
      showAxes: false,
      orbitEnabled: true,
      environment: 'studio',
      animationClips: [],
      activeClip: 0,
      isPlaying: false,
      viewStats: null,
      panelOpen: false,
      sceneInspection: null,
      studioModelId: modelId,
    });
  },
}));
