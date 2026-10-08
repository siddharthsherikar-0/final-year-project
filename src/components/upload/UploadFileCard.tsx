import { formatFileSize } from '@/utils/format';
import type { ModelFileStats } from '@/utils/modelMetadata';

export type FileValidationState = 'checking' | 'valid' | 'invalid';

interface UploadFileCardProps {
  file: File;
  stats: ModelFileStats | null;
  validation: FileValidationState;
  validationMessage?: string | null;
  disabled?: boolean;
  onRemove: () => void;
}

function formatStat(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-US');
}

const STATUS: Record<
  FileValidationState,
  { label: string; className: string; testId: string }
> = {
  checking: {
    label: 'Validating file…',
    // System progress, not a caution -> --info.
    className: 'border-info/40 bg-info/10 text-info',
    testId: 'upload-status-checking',
  },
  valid: {
    label: 'Ready to upload',
    className: 'border-success/40 bg-success/10 text-success',
    testId: 'upload-status-valid',
  },
  invalid: {
    label: 'Cannot upload',
    className: 'border-danger/40 bg-danger/10 text-danger',
    testId: 'upload-status-invalid',
  },
};

interface StatRowProps {
  label: string;
  testId: string;
  value: string;
}

function StatRow({ label, testId, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className="text-xs font-medium tabular-nums text-ink"
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}

const HEAVY_MODEL_TRIANGLES = 500_000;

export function UploadFileCard({
  file,
  stats,
  validation,
  validationMessage,
  disabled = false,
  onRemove,
}: UploadFileCardProps) {
  const status = STATUS[validation];
  const extension = file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const isHeavy = (stats?.triangles ?? 0) >= HEAVY_MODEL_TRIANGLES;

  return (
    <section
      aria-label="Selected file"
      data-testid="upload-file-card"
      className="rounded-panel border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-ink"
            data-testid="upload-filename"
            title={file.name}
          >
            {file.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              data-testid="upload-format"
              className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
            >
              {extension}
            </span>
            <span className="text-xs text-ink-muted" data-testid="upload-size">
              {formatFileSize(file.size)}
            </span>
            <span
              data-testid={status.testId}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Remove selected file"
          data-testid="upload-remove-file"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-elevated text-ink-muted transition-colors hover:bg-interactive hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {validation === 'invalid' && validationMessage && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {validationMessage}
        </p>
      )}

      {isHeavy && (
        <p
          role="note"
          data-testid="upload-heavy-warning"
          className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          This model is very heavy ({formatStat(stats!.triangles)} triangles). It
          will upload, but may load slowly on weaker devices.
        </p>
      )}

      <dl className="mt-3 divide-y divide-line border-t border-line">
        <StatRow
          label="Vertices"
          testId="upload-stat-vertices"
          value={stats ? formatStat(stats.vertices) : '…'}
        />
        <StatRow
          label="Triangles"
          testId="upload-stat-triangles"
          value={stats ? formatStat(stats.triangles) : '…'}
        />
        <StatRow
          label="Textures"
          testId="upload-stat-textures"
          value={stats ? formatStat(stats.textures) : '…'}
        />
        <StatRow
          label="Animations"
          testId="upload-stat-animations"
          value={stats ? formatStat(stats.animations) : '…'}
        />
      </dl>
    </section>
  );
}
