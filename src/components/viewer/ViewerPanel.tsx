import { useViewerStore, type EnvironmentPreset } from '@/stores/useViewerStore';
import { zoomLevel } from './viewerUtils';
import { formatFileSize } from '@/utils/format';
import type { SceneInspection } from '@/utils/sceneInspection';

interface ViewerPanelProps {
  open: boolean;
  onClose: () => void;
  modelName?: string;
  dpr?: number;
  /**
   * `overlay` is the existing behaviour: a panel floating above the viewport.
   * `studio` participates in the Studio page layout - a right-hand column on
   * desktop, a bottom sheet under 1024px.
   */
  variant?: 'overlay' | 'studio';
  /** File-level facts the API already knows; the panel shows `—` without them. */
  asset?: {
    format?: string;
    fileSize?: number;
    hasTextures?: boolean;
    author?: string;
  } | null;
  className?: string;
/** Lets the owner return focus to the panel trigger after closing. */
  panelRef?: React.Ref<HTMLElement>;
  /** Stage 9B: optional editor UI rendered above the inspection sections. */
  editorContent?: React.ReactNode;
}

const ENVIRONMENTS: ReadonlyArray<{ id: EnvironmentPreset; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'sunset', label: 'Sunset' },
];

/** Studio instrumentation reads as one aligned ledger, not a stack of boxes. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className="font-mono text-xs tabular-nums text-ink"
        data-testid={`stat-${label}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Unknown values are always an em dash - never a fabricated zero. */
const DASH = '—';

function count(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US')
    : DASH;
}

function dimensionText(inspection: SceneInspection | null): string {
  const dims = inspection?.dimensions;
  if (!dims) return DASH;
  return dims.map((value) => value.toFixed(2)).join(' × ');
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[32px] rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-ring ${
        active
          ? 'border-accent/60 bg-accent-subtle text-accent'
          : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

export function ViewerPanel({
  open,
  onClose,
  modelName,
  dpr,
  variant = 'overlay',
  asset = null,
className = '',
  panelRef,
  editorContent,
}: ViewerPanelProps) {
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
  const inspection = useViewerStore((s) => s.sceneInspection);

  const isWireframe = useViewerStore((s) => s.isWireframe);
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe);
  const showGrid = useViewerStore((s) => s.showGrid);
  const toggleGrid = useViewerStore((s) => s.toggleGrid);
  const showAxes = useViewerStore((s) => s.showAxes);
  const toggleAxes = useViewerStore((s) => s.toggleAxes);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const toggleAutoRotate = useViewerStore((s) => s.toggleAutoRotate);

  if (!open) return null;

  const zoom = Math.round(
    zoomLevel(cameraPosition, controlsTarget, 0.05, 1000) * 100,
  );

const shell =
    variant === 'studio'
      ? // Studio: a real layout column on desktop, a bottom sheet under 1024px.
        // `lg:h-full` + the wrapper's `overflow-hidden` make the panel fill its
        // column and scroll internally instead of expanding the workspace.
        'flex h-full min-h-0 w-full flex-col bg-surface lg:w-full lg:shrink-0 lg:border-l lg:border-line ' +
        'max-h-[34dvh] overflow-y-auto overflow-x-hidden border-t border-line md:max-h-[28dvh] lg:max-h-none lg:border-t-0'
      : 'absolute right-0 top-0 z-30 h-full w-72 max-w-[85%] overflow-y-auto border-l border-line bg-surface p-4 shadow-lift';

  return (
    <aside
      ref={panelRef}
      id={variant === 'studio' ? 'viewer-inspection-panel' : undefined}
      aria-label="Studio panel"
      data-variant={variant}
      className={`${shell} p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">
          Inspection
        </h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-control bg-elevated text-ink-muted transition-colors hover:bg-interactive hover:text-ink focus-ring"
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

<div className="mt-4 space-y-4">
        {/* Stage 9B editor slot: the transform inspector renders above the
            inspection readout so the existing Stage 8 panel is preserved
            rather than replaced. Omitted outside editor layouts. */}
        {editorContent}

        {/* SCENE - read from the model that is already rendered. */}
        <Section title="Scene">
          <dl className="divide-y divide-line">
            <StatRow label="Meshes" value={count(inspection?.meshCount)} />
            <StatRow label="Materials" value={count(inspection?.materialCount)} />
            <StatRow
              label="Triangles"
              value={
                viewStats?.triangles
                  ? viewStats.triangles.toLocaleString('en-US')
                  : count(inspection?.triangleCount)
              }
            />
            <StatRow label="Dimensions" value={dimensionText(inspection)} />
          </dl>
          {inspection && inspection.namedObjectCount > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              {inspection.namedObjectCount} named{' '}
              {inspection.namedObjectCount === 1 ? 'object' : 'objects'}
              {inspection.skinnedMeshCount > 0
                ? ` · ${inspection.skinnedMeshCount} skinned`
                : ''}
            </p>
          )}
        </Section>

        {/* ASSET - facts the API already owns. */}
        <Section title="Asset">
          <dl className="divide-y divide-line">
            <StatRow
              label="Format"
              value={asset?.format ? asset.format.toUpperCase() : DASH}
            />
            <StatRow
              label="File size"
              value={
                typeof asset?.fileSize === 'number'
                  ? formatFileSize(asset.fileSize)
                  : DASH
              }
            />
            <StatRow
              label="Textures"
              value={
                typeof inspection?.textureCount === 'number' &&
                inspection.textureCount > 0
                  ? count(inspection.textureCount)
                  : typeof asset?.hasTextures === 'boolean'
                    ? asset.hasTextures
                      ? 'Included'
                      : 'None'
                    : DASH
              }
            />
            <StatRow
              label="Animations"
              value={count(animationClips.length)}
            />
          </dl>
        </Section>

        {animationClips.length > 0 && (
          <Section title="Animation">
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="viewer-clip-select">
                Animation clip
              </label>
              <select
                id="viewer-clip-select"
                value={activeClip}
                onChange={(event) => setActiveClip(Number(event.target.value))}
                className="min-w-0 flex-1 rounded-md border border-control bg-elevated px-2 py-1.5 font-mono text-xs text-ink focus-ring"
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
                className={`min-h-[32px] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
                  isPlaying
                    ? 'border-accent/60 bg-accent-subtle text-accent'
                    : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
                }`}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Clip {activeClip + 1} of {animationClips.length}
            </p>
          </Section>
        )}

        <Section title="Environment">
          <div role="radiogroup" aria-label="Environment preset" className="flex gap-1.5">
            {ENVIRONMENTS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={environment === preset.id}
                onClick={() => setEnvironment(preset.id)}
                className={`min-h-[32px] flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-ring ${
                  environment === preset.id
                    ? 'border-accent/60 bg-accent-subtle text-accent'
                    : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="View">
          <div className="flex flex-wrap gap-1.5">
            <ToggleButton
              label="Wireframe"
              active={isWireframe}
              onClick={toggleWireframe}
            />
            <ToggleButton label="Grid" active={showGrid} onClick={toggleGrid} />
            <ToggleButton label="Axes" active={showAxes} onClick={toggleAxes} />
            <ToggleButton
              label="Auto rotate"
              active={autoRotate}
              onClick={toggleAutoRotate}
            />
          </div>
          <dl className="mt-2 divide-y divide-line">
            <StatRow
              label="Draw calls"
              value={viewStats ? String(viewStats.calls) : DASH}
            />
            <StatRow label="Zoom" value={`${zoom}%`} />
            <StatRow label="Pixel ratio" value={dpr ? String(dpr) : 'auto'} />
          </dl>
        </Section>
      </div>
    </aside>
  );
}

