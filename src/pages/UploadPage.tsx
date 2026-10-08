import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { UploadFileCard } from '@/components/upload/UploadFileCard';

const UploadPreview = lazy(() =>
  import('@/components/upload/UploadPreview').then((m) => ({
    default: m.UploadPreview,
  })),
);
import {
  extractModelMetadata,
  MAX_UPLOAD_MB,
  type ModelFileStats,
} from '@/utils/modelMetadata';
import { uploadModel, type UploadedModelSummary } from '@/utils/uploadRequest';
import { formatFileSize } from '@/utils/format';
import { PageHeader } from '@/components/studio/PageHeader';
import { isFileSizeValid, isValidModelFormat } from '@/utils/validation';

type UploadPhase = 'editing' | 'uploading' | 'success';
type FileValidation = 'none' | 'checking' | 'valid' | 'invalid';

const CATEGORIES = [
  { value: 'architecture', label: 'Architecture' },
  { value: 'characters', label: 'Characters' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'nature', label: 'Nature' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'other', label: 'Other' },
] as const;

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FileValidation>('none');
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [stats, setStats] = useState<ModelFileStats | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('editing');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedModelSummary | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const extractTokenRef = useRef(0);
  const { token, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const isUploading = phase === 'uploading';

  const clearFileState = () => {
    extractTokenRef.current += 1;
    setFile(null);
    setStats(null);
    setValidation('none');
    setValidationMessage(null);
    setThumbnail(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelected = (selected: File) => {
    if (isUploading) return;
    setDropError(null);
    setError(null);

    if (!isValidModelFormat(selected.name)) {
      setDropError('Only GLB and GLTF files are allowed');
      return;
    }
    if (!isFileSizeValid(selected.size, MAX_UPLOAD_MB)) {
      setDropError(
        `File is too large (${formatFileSize(selected.size)}). Maximum size is ${MAX_UPLOAD_MB} MB.`,
      );
      return;
    }

    setFile(selected);
    setStats(null);
    setValidation('checking');
    setValidationMessage(null);
    setThumbnail(null);
    setName((current) =>
      current.trim()
        ? current
        : selected.name.replace(/\.(glb|gltf)$/i, '').trim(),
    );

    const extractToken = (extractTokenRef.current += 1);
    void extractModelMetadata(selected).then((result) => {
      if (extractToken !== extractTokenRef.current) return;
      if (result.ok) {
        setStats(result.stats);
        setValidation('valid');
      } else {
        setStats(null);
        setValidation('invalid');
        setValidationMessage(result.error);
      }
    });
  };

  const handleRemoveFile = () => {
    if (isUploading) return;
    clearFileState();
    setDropError(null);
    setError(null);
  };

  const nameOk = name.trim().length > 0;
  const descriptionOk = description.trim().length > 0;
  const canSubmit =
    !!file &&
    validation === 'valid' &&
    nameOk &&
    descriptionOk &&
    !isUploading;

  const hint = (() => {
    if (isUploading || phase === 'success') return null;
    if (!file) return 'Select a model file to continue.';
    if (validation === 'checking') return 'Validating your file…';
    if (validation === 'invalid') return 'Choose a valid GLB or GLTF file.';
    if (!nameOk) return 'Add a model name to continue.';
    if (!descriptionOk) return 'Add a description to continue.';
    return null;
  })();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || isUploading) return;
    if (!file || validation !== 'valid') {
      setError('Select a valid model file first');
      return;
    }
    if (!nameOk || !descriptionOk) {
      setError('Please fill in all fields and select a file');
      return;
    }

    submittingRef.current = true;
    setPhase('uploading');
    setError(null);
    setProgress(null);

    try {
      const model = await uploadModel(
        {
          file,
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
          token,
          thumbnail,
        },
        (percent) => setProgress(percent),
      );
      setUploaded(model);
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('editing');
    } finally {
      submittingRef.current = false;
    }
  };

  const resetAll = () => {
    clearFileState();
    setPhase('editing');
    setUploaded(null);
    setProgress(null);
    setError(null);
    setDropError(null);
    setName('');
    setDescription('');
    setTags('');
    setCategory('other');
  };

  if (!isAuthenticated) {
    return null;
  }

return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Publish"
        title="Add a 3D asset"
        description="Drop a GLB or GLTF file, check the studio preview we generate from it, add the asset details, then publish it to your gallery."
      />

      <div className="mt-8">
      {phase === 'success' && uploaded ? (
        <div
          role="status"
          data-testid="upload-success"
          className="rounded-card border border-line bg-surface p-6"
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt={`Studio preview of ${uploaded.name}`}
              data-testid="upload-success-preview"
              className="aspect-[4/3] w-full rounded-md border border-line object-cover"
            />
          )}

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Published
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">
            {uploaded.name} is live
          </h2>
          <p className="mt-2 text-sm text-ink-muted" data-testid="upload-success-name">
            Your asset is in the gallery with its studio preview. Open it in the
            viewer to inspect every detail.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              data-testid="upload-view-model"
              onClick={() => navigate(`/model/${uploaded.id}`)}
            >
              View model page
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-testid="upload-upload-another"
              onClick={resetAll}
            >
              Upload another
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div
              role="alert"
              data-testid="upload-error"
              className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <UploadDropzone
            onFileSelected={handleFileSelected}
            disabled={isUploading}
            error={dropError}
            inputRef={fileInputRef}
          />

          {file && (
            <UploadFileCard
              file={file}
              stats={stats}
              validation={
                validation === 'none' ? 'checking' : validation
              }
              validationMessage={validationMessage}
              disabled={isUploading}
              onRemove={handleRemoveFile}
            />
          )}

          {file && validation === 'valid' && (
            <Suspense
              fallback={
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              }
            >
              <UploadPreview file={file} onThumbnailReady={setThumbnail} />
            </Suspense>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Asset details
            </h2>
            <div>
              <label
                htmlFor="upload-name"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Name
              </label>
              <input
                id="upload-name"
                data-testid="upload-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isUploading}
                className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-ring disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="upload-description"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Description
              </label>
              <textarea
                id="upload-description"
                data-testid="upload-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isUploading}
                rows={3}
                className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-ring disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="upload-category"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Category
              </label>
              <select
                id="upload-category"
                data-testid="upload-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={isUploading}
                className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink focus-ring disabled:opacity-60"
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="upload-tags"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Tags (comma-separated)
              </label>
              <input
                id="upload-tags"
                data-testid="upload-tags"
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                disabled={isUploading}
                placeholder="e.g. character, animated, game-ready"
                className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-ring disabled:opacity-60"
              />
            </div>

            {isUploading && (
              <div className="space-y-2" data-testid="upload-progress-wrap">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>Uploading your model…</span>
                  <span data-testid="upload-progress-text">
                    {progress !== null ? `${progress}%` : 'Transferring…'}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  {...(progress !== null ? { 'aria-valuenow': progress } : {})}
                  data-testid="upload-progress"
                  className="h-2 w-full overflow-hidden rounded-full bg-line"
                >
                  <div
                    className={`h-full rounded-full bg-info transition-[width] duration-300 motion-reduce:transition-none ${
                      progress === null ? 'w-2/5' : ''
                    }`}
                    style={
                      progress !== null ? { width: `${progress}%` } : undefined
                    }
                  />
                </div>
              </div>
            )}

            {hint && (
              <p
                data-testid="upload-hint"
                className="text-xs text-ink-muted"
              >
                {hint}
              </p>
            )}

            <Button
              type="submit"
              data-testid="upload-submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Uploading…
                </>
              ) : (
                'Upload model'
              )}
            </Button>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}

