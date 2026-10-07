import { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { ModelViewer } from '@/components/viewer/ModelViewer';

interface UploadPreviewProps {
  file: File;
}

export function UploadPreview({ file }: UploadPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
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
        <ModelViewer modelUrl={url} modelName={file.name} />
      </div>
    </section>
  );
}
