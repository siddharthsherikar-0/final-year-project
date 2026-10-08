import { lazy, Suspense, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { Spinner } from '@/components/ui/Spinner';
import { loadModelViewer } from '@/components/viewer/lazyModelViewer';

const ModelViewer = lazy(loadModelViewer);

interface UploadPreviewProps {
  file: File;
}

export function UploadPreview({ file }: UploadPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // Blob URLs are an external resource: create/revoke must pair with the
    // effect lifecycle (StrictMode-safe) rather than a render-time memo,
    // which would leak the discarded double-invoked URL. The setState only
    // publishes that external resource for rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => {
      try {
        useGLTF.clear(objectUrl);
      } catch {
        // cache entry may already be gone
      }
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) return null;

  return (
    <section
      aria-label="Model preview"
      data-testid="upload-preview"
      className="rounded-panel border border-line bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-ink">Preview</h2>
        <p className="text-xs text-ink-muted">
          Interactive preview of your model
        </p>
      </div>
      <div className="h-56 overflow-hidden rounded-md border border-line bg-bg sm:h-72">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner size="sm" />
            </div>
          }
        >
          <ModelViewer modelUrl={url} modelName={file.name} />
        </Suspense>
      </div>
    </section>
  );
}
