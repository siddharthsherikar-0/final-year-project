import { useViewerStore, type EnvironmentPreset } from '@/stores/useViewerStore';
import { zoomLevel } from './viewerUtils';

interface ViewerPanelProps {
  open: boolean;
  onClose: () => void;
  modelName?: string;
  dpr?: number;
}

const ENVIRONMENTS: ReadonlyArray<{ id: EnvironmentPreset; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'sunset', label: 'Sunset' },
];

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-xs font-medium tabular-nums text-ink" data-testid={`stat-${label}`}>
        {value}
      </dd>
    </div>
  );
}

export function ViewerPanel({ open, onClose, modelName, dpr }: ViewerPanelProps) {
  const environment = useViewerStore((s) => s.environment);
  const setEnvironment = useViewerStore((s) => s.setEnvironment);
  const animationClips = useViewerStore((s) => s.animationClips);
  const activeClip = useViewerStore((s) => s.activeClip);
  const setActiveClip = useViewerStore((s) => s.setActiveClip);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const togglePlaying = useViewerStore((s) => s.togglePlaying);
  const viewStats = useViewerStore((s) => s.viewStats);
  const cameraPosition = useViewerStore((s) => s.cameraPosition);
  const controlsTarget = useViewerStore((s) => s.controlsTarget);

  if (!open) return null;

  const zoom = Math.round(
    zoomLevel(cameraPosition, controlsTarget, 0.05, 1000) * 100,
  );

  return (
    <aside
      aria-label="Studio panel"
      className="absolute right-0 top-0 z-30 h-full w-72 max-w-[85%] overflow-y-auto border-l border-line bg-surface p-4 shadow-lift"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink">Studio panel</h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-control bg-elevated text-ink-muted transition-colors hover:bg-interactive hover:text-ink focus-ring"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {modelName && (
        <p className="mt-1 truncate text-xs text-ink-muted" title={modelName}>
          {modelName}
        </p>
      )}

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Environment
        </h3>
        <div
          role="radiogroup"
          aria-label="Environment preset"
          className="mt-2 flex gap-1.5"
        >
          {ENVIRONMENTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={environment === preset.id}
              onClick={() => setEnvironment(preset.id)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-ring ${
                environment === preset.id
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {animationClips.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Animation
          </h3>
          <div className="mt-2 flex gap-1.5">
            <label className="sr-only" htmlFor="viewer-clip-select">
              Animation clip
            </label>
            <select
              id="viewer-clip-select"
              value={activeClip}
              onChange={(event) => setActiveClip(Number(event.target.value))}
              className="min-w-0 flex-1 rounded-md border border-control bg-elevated px-2 py-1.5 text-xs text-ink focus-ring"
            >
              {animationClips.map((clip, index) => (
                <option key={clip} value={index}>
                  {clip}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              aria-pressed={isPlaying}
              onClick={togglePlaying}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
                isPlaying
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
              }`}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </section>
      )}

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          View
        </h3>
        <dl className="mt-1 divide-y divide-line">
          <StatRow
            label="Triangles"
            value={
              viewStats ? viewStats.triangles.toLocaleString('en-US') : '—'
            }
          />
          <StatRow
            label="Draw calls"
            value={viewStats ? String(viewStats.calls) : '—'}
          />
          <StatRow label="Zoom" value={`${zoom}%`} />
          <StatRow label="Pixel ratio" value={dpr ? String(dpr) : 'auto'} />
        </dl>
      </section>
    </aside>
  );
}
