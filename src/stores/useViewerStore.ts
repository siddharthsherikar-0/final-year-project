import { create } from 'zustand';

interface ViewerState {
  cameraPosition: [number, number, number];
  isWireframe: boolean;
  autoRotate: boolean;
  showGrid: boolean;
  setCameraPosition: (pos: [number, number, number]) => void;
  toggleWireframe: () => void;
  toggleAutoRotate: () => void;
  toggleGrid: () => void;
  resetCamera: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  cameraPosition: [0, 1, 5],
  isWireframe: false,
  autoRotate: false,
  showGrid: true,

  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  toggleWireframe: () => set((s) => ({ isWireframe: !s.isWireframe })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  resetCamera: () => set({ cameraPosition: [0, 1, 5] }),
}));
