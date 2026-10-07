import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ModelScene } from './ModelScene';
import { ViewerOverlay } from './ViewerOverlay';
import { ViewerToolbar } from './ViewerToolbar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

interface ModelViewerProps {
  modelUrl: string;
  modelName?: string;
  className?: string;
}

export function ModelViewer({ modelUrl, modelName, className = '' }: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <ErrorBoundary>
      <div className={`relative h-full w-full ${className}`}>
        <Canvas
          key={modelUrl}
          camera={{ position: [0, 1, 5], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={() => setIsLoading(false)}
          onError={(err) => {
            setError(err instanceof Error ? err.message : 'Failed to initialize renderer');
          }}
        >
          <Suspense fallback={null}>
            <ModelScene modelUrl={modelUrl} />
          </Suspense>
        </Canvas>

        <ViewerOverlay isLoading={isLoading} error={error} modelName={modelName} />
        <ViewerToolbar />
      </div>
    </ErrorBoundary>
  );
}
