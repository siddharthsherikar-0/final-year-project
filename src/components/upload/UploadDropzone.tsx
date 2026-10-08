import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { MAX_UPLOAD_MB } from '@/utils/modelMetadata';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
}

export function UploadDropzone({
  onFileSelected,
  disabled = false,
  error,
  inputRef,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      onFileSelected(dropped);
    }
  };

  const borderClass = error
    ? 'border-danger'
    : isDragging
      ? 'border-accent bg-accent-soft/40'
      : 'border-line bg-surface hover:border-ink-faint';

  return (
    <div>
      <div
        data-testid="upload-dropzone"
        aria-disabled={disabled}
        onClick={openPicker}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed px-6 py-8 text-center transition-colors duration-base motion-reduce:transition-none ${borderClass} ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-9 w-9 ${error ? 'text-danger' : isDragging ? 'text-accent' : 'text-ink-faint'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4m0 0L7 9m5-5l5 5" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <div>
          <p className="text-sm font-medium text-ink" data-testid="dropzone-title">
            {isDragging ? 'Drop your model here' : 'Drag & drop your model'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            GLB or GLTF &middot; up to {MAX_UPLOAD_MB} MB
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          data-testid="upload-browse"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            openPicker();
          }}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf"
          data-testid="upload-input"
          // Visually hidden until keyboard-focused, then revealed with a focus
          // ring so keyboard users can see where focus landed.
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:border focus:border-control focus:bg-surface focus:px-3 focus:py-2 focus:text-xs focus:text-ink focus-ring"
          disabled={disabled}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onFileSelected(selected);
            }
            event.target.value = '';
          }}
        />
      </div>
      {error && (
        <p
          role="alert"
          data-testid="upload-dropzone-error"
          className="mt-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
