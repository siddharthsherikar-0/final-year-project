export function loadModelViewer() {
  return import('@/components/viewer/ModelViewer').then((m) => ({
    default: m.ModelViewer,
  }));
}
