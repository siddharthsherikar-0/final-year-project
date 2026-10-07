import { useViewerStore } from '@/stores/useViewerStore';
import { Button } from '@/components/ui/Button';

export function ViewerToolbar() {
  const isWireframe = useViewerStore((s) => s.isWireframe);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const showGrid = useViewerStore((s) => s.showGrid);
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe);
  const toggleAutoRotate = useViewerStore((s) => s.toggleAutoRotate);
  const toggleGrid = useViewerStore((s) => s.toggleGrid);
  const resetCamera = useViewerStore((s) => s.resetCamera);

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
      <Button
        variant={isWireframe ? 'primary' : 'secondary'}
        onClick={toggleWireframe}
        className="text-xs"
      >
        Wireframe
      </Button>
      <Button
        variant={autoRotate ? 'primary' : 'secondary'}
        onClick={toggleAutoRotate}
        className="text-xs"
      >
        Auto-Rotate
      </Button>
      <Button
        variant={showGrid ? 'primary' : 'secondary'}
        onClick={toggleGrid}
        className="text-xs"
      >
        Grid
      </Button>
      <Button variant="ghost" onClick={resetCamera} className="text-xs">
        Reset Camera
      </Button>
    </div>
  );
}
