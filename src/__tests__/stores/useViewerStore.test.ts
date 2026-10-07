import { describe, it, expect, beforeEach } from 'vitest';
import { useViewerStore } from '@/stores/useViewerStore';

function resetStore() {
  useViewerStore.setState({
    cameraPosition: [0, 1, 5],
    controlsTarget: [0, 0, 0],
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
  });
}

describe('useViewerStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with deterministic defaults', () => {
    const state = useViewerStore.getState();
    expect(state.cameraPosition).toEqual([0, 1, 5]);
    expect(state.controlsTarget).toEqual([0, 0, 0]);
    expect(state.lastFrame).toBeNull();
    expect(state.isWireframe).toBe(false);
    expect(state.autoRotate).toBe(false);
    expect(state.showGrid).toBe(true);
    expect(state.showAxes).toBe(false);
    expect(state.orbitEnabled).toBe(true);
    expect(state.environment).toBe('studio');
    expect(state.animationClips).toEqual([]);
    expect(state.isPlaying).toBe(false);
    expect(state.viewStats).toBeNull();
  });

  it('flips every boolean toggle', () => {
    const store = useViewerStore.getState();
    store.toggleWireframe();
    store.toggleAutoRotate();
    store.toggleGrid();
    store.toggleAxes();
    store.toggleOrbit();

    const state = useViewerStore.getState();
    expect(state.isWireframe).toBe(true);
    expect(state.autoRotate).toBe(true);
    expect(state.showGrid).toBe(false);
    expect(state.showAxes).toBe(true);
    expect(state.orbitEnabled).toBe(false);

    useViewerStore.getState().toggleWireframe();
    useViewerStore.getState().toggleAutoRotate();
    useViewerStore.getState().toggleGrid();
    useViewerStore.getState().toggleAxes();
    useViewerStore.getState().toggleOrbit();

    const restored = useViewerStore.getState();
    expect(restored.isWireframe).toBe(false);
    expect(restored.autoRotate).toBe(false);
    expect(restored.showGrid).toBe(true);
    expect(restored.showAxes).toBe(false);
    expect(restored.orbitEnabled).toBe(true);
  });

  it('cycles environment presets in order and can set them directly', () => {
    useViewerStore.getState().cycleEnvironment();
    expect(useViewerStore.getState().environment).toBe('midnight');
    useViewerStore.getState().cycleEnvironment();
    expect(useViewerStore.getState().environment).toBe('sunset');
    useViewerStore.getState().cycleEnvironment();
    expect(useViewerStore.getState().environment).toBe('studio');

    useViewerStore.getState().setEnvironment('sunset');
    expect(useViewerStore.getState().environment).toBe('sunset');
  });

  it('sets a full camera pose and resets to defaults', () => {
    useViewerStore
      .getState()
      .setCameraPose({ position: [3, 4, 5], target: [1, 2, 3] });
    expect(useViewerStore.getState().cameraPosition).toEqual([3, 4, 5]);
    expect(useViewerStore.getState().controlsTarget).toEqual([1, 2, 3]);

    useViewerStore.getState().resetCamera();
    expect(useViewerStore.getState().cameraPosition).toEqual([0, 1, 5]);
    expect(useViewerStore.getState().controlsTarget).toEqual([0, 0, 0]);
  });

  it('stores and re-applies the last frame', () => {
    expect(useViewerStore.getState().lastFrame).toBeNull();
    useViewerStore
      .getState()
      .setLastFrame({ position: [7, 8, 9], target: [0, 1, 0] });
    useViewerStore.getState().resetCamera();
    useViewerStore.getState().applyLastFrame();
    expect(useViewerStore.getState().cameraPosition).toEqual([7, 8, 9]);
    expect(useViewerStore.getState().controlsTarget).toEqual([0, 1, 0]);
  });

  it('resets playback state when clips change', () => {
    useViewerStore.getState().setAnimationClips(['Idle', 'Walk']);
    useViewerStore.getState().setActiveClip(1);
    useViewerStore.getState().togglePlaying();
    expect(useViewerStore.getState().isPlaying).toBe(true);

    useViewerStore.getState().setAnimationClips(['Run']);
    expect(useViewerStore.getState().activeClip).toBe(0);
    expect(useViewerStore.getState().isPlaying).toBe(false);
  });

  it('clamps the active clip index into range', () => {
    useViewerStore.getState().setAnimationClips(['A', 'B']);
    useViewerStore.getState().setActiveClip(99);
    expect(useViewerStore.getState().activeClip).toBe(1);
    useViewerStore.getState().setActiveClip(-5);
    expect(useViewerStore.getState().activeClip).toBe(0);
  });

  it('stores view stats', () => {
    useViewerStore.getState().setViewStats({ triangles: 4200, calls: 12 });
    expect(useViewerStore.getState().viewStats).toEqual({
      triangles: 4200,
      calls: 12,
    });
  });
});
