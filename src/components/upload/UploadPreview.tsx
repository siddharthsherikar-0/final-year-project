import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { ModelMedia } from '@/components/gallery/ModelMedia';
import {
  generateThumbnailFromFile,
  type ThumbnailResult,
} from '@/utils/thumbnailRenderer';

type PreviewState =
  | { phase: 'rendering' }
  | { phase: 'ready'; thumbnail: ThumbnailResult }
  | { phase: 'failed'; reason: string };

interface UploadPreviewProps {
  file: File;
  /** Publishes the encoded preview so it can be persisted with the model. */
  onThumbnailReady?: (dataUrl: string | null) => void;
}

const FAILURE_COPY: Record<string, string> = {
  'webgl-unavailable':
    'This browser cannot render 3D previews. The model will still publish without one.',
  'load-failed':
    'The file could not be read for previewing. The model will still publish without one.',
  'empty-model':
    'No visible geometry was found. The model will still publish without a preview.',
  'render-failed':
    'The preview could not be rendered. The model will still publish without one.',
  timeout:
    'Previewing took too long. The model will still publish without one.',
};

export function UploadPreview({ file, onThumbnailReady }: UploadPreviewProps) {
  // The render state is derived from the file, so a new file starts in the
  // rendering phase without a setState-in-effect pass: the previous preview
  // only stays visible while the same file is being re-rendered.
  const [result, setResult] = useState<{
    file: File;
    state: PreviewState;
  } | null>(null);

  const stale = result !== null && result.file !== file;
  const state: PreviewState = result === null || stale
    ? { phase: 'rendering' }
    : result.state;

  useEffect(() => {
    let active = true;

    generateThumbnailFromFile(file)
      .then((thumbnail) => {
        if (!active) return;
        setResult({
          file,
          state: { phase: 'ready', thumbnail },
        });
        onThumbnailReady?.(thumbnail.dataUrl);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const reason =
          error instanceof Error && 'reason' in error
            ? String((error as { reason: string }).reason)
            : 'render-failed';
        setResult({
          file,
          state: {
            phase: 'failed',
            reason: FAILURE_COPY[reason] ?? FAILURE_COPY['render-failed']!,
          },
        });
        onThumbnailReady?.(null);
      });

    return () => {
      active = false;
    };
  }, [file, onThumbnailReady]);

  return (
    <section
      aria-label="Asset preview"
      data-testid="upload-preview"
      className="rounded-card border border-line bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          Asset preview
        </h2>
        <p className="text-xs text-ink-muted">
          This is what the gallery will show
        </p>
      </div>

      <div className="p-4">
        {state.phase === 'rendering' && (
          <div
            role="status"
            aria-busy="true"
            data-testid="upload-preview-loading"
            className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-line bg-bg"
          >
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner size="sm" />
              Rendering preview
            </span>
          </div>
        )}

        {state.phase === 'ready' && (
          <div className="overflow-hidden rounded-md border border-line">
            <img
              src={state.thumbnail.dataUrl}
              alt={`Studio preview of ${file.name}`}
              width={state.thumbnail.width}
              height={state.thumbnail.height}
              data-testid="upload-preview-image"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}

        {state.phase === 'failed' && (
          <>
            <ModelMedia
              category="other"
              format="glb"
              className="aspect-[4/3] w-full rounded-md border border-line"
            />
            <p className="mt-3 text-xs text-ink-muted" data-testid="upload-preview-fallback">
              {state.reason}
            </p>
          </>
        )}
      </div>
    </section>
  );
}