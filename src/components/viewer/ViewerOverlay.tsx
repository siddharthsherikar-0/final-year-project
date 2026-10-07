import { Spinner } from '@/components/ui/Spinner';

interface ViewerOverlayProps {
  isLoading: boolean;
  error: string | null;
  modelName?: string;
}

export function ViewerOverlay({ isLoading, error, modelName }: ViewerOverlayProps) {
  if (error) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80">
        <div className="rounded-lg bg-red-900/90 p-6 text-center">
          <p className="text-lg font-semibold text-red-200">Failed to load model</p>
          <p className="mt-2 text-sm text-red-300">{error}</p>
          {modelName && <p className="mt-1 text-xs text-red-400">{modelName}</p>}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/60">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-blue-400" />
          <p className="text-sm text-gray-300">
            Loading {modelName ?? 'model'}...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
