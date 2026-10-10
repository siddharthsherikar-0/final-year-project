import { useId } from 'react';
import { useViewerStore, type EnvironmentPreset } from '@/stores/useViewerStore';

interface IconButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Lets a toggle button also expose aria-expanded (e.g. the panel opener). */
  expanded?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const IDLE_CLASS =
  'border-line bg-elevated text-ink-muted hover:bg-interactive hover:text-ink';
const ACTIVE_CLASS =
  'border-accent bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent';

function IconButton({
  label,
  shortcut,
  active,
  disabled = false,
  onClick,
  children,
  expanded,
  buttonRef,
}: IconButtonProps) {
  // The tooltip keeps the existing CSS reveal (hover + focus-visible) and is
  // now exposed to assistive tech: role="tooltip" plus aria-describedby on the
  // trigger, so the hint is announced instead of being hover-only decoration.
  const tooltipId = useId();

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-describedby={tooltipId}
      aria-pressed={active}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-control transition-[background-color,border-color,color,transform] duration-fast active:translate-y-px after:absolute after:-inset-y-2 after:-inset-x-1 after:content-[''] focus-ring-tight disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${
        active ? ACTIVE_CLASS : IDLE_CLASS
      }`}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-md border border-line bg-elevated px-2 py-1 text-[11px] font-medium text-ink opacity-0 shadow-card transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {label}
        {shortcut && (
          <>
            <kbd className="ml-1.5 font-mono text-ink-faint">{shortcut}</kbd>
            <span className="sr-only">, keyboard shortcut {shortcut}</span>
          </>
        )}
      </span>
    </button>
  );
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  className: 'h-4 w-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const ICONS = {
  reset: (
    <svg {...ICON_PROPS}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4.5v5h5" />
    </svg>
  ),
  frame: (
    <svg {...ICON_PROPS}>
      <path d="M4 8V4h4" />
      <path d="M16 4h4v4" />
      <path d="M20 16v4h-4" />
      <path d="M8 20H4v-4" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  zoomIn: (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20.5 20.5 16 16" />
      <path d="M11 8.5v5M8.5 11h5" />
    </svg>
  ),
  zoomOut: (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20.5 20.5 16 16" />
      <path d="M8.5 11h5" />
    </svg>
  ),
  autoRotate: (
    <svg {...ICON_PROPS}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M21 4.5v5h-5" />
    </svg>
  ),
  orbit: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="2.5" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.5" transform="rotate(-28 12 12)" />
    </svg>
  ),
  grid: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
    </svg>
  ),
  axes: (
    <svg {...ICON_PROPS}>
      <path d="M5 19V5" />
      <path d="M5 19h14" />
      <path d="M5 19 16 8" />
      <path d="M16 8h-3.5M16 8v3.5" />
    </svg>
  ),
  wireframe: (
    <svg {...ICON_PROPS}>
      <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5Z" />
      <path d="M12 12 19.5 8M12 12v8.5M12 12 4.5 8" />
    </svg>
  ),
  background: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  screenshot: (
    <svg {...ICON_PROPS}>
      <path d="M4 8.5h3l1.8-2h6.4l1.8 2h3v10H4v-10Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  ),
  fullscreen: (
    <svg {...ICON_PROPS}>
      <path d="M4 9V4h5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M9 20H4v-5" />
    </svg>
  ),
  help: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1.9-1.1 1.8" />
      <path d="M12 16.6h.01" />
    </svg>
  ),
  panel: (
    <svg {...ICON_PROPS}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const ENV_LABELS: Record<EnvironmentPreset, string> = {
  studio: 'Studio',
  midnight: 'Midnight',
  sunset: 'Sunset',
};

interface ViewerDockProps {
  onReset: () => void;
  onFrame: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onScreenshot: () => void;
  onFullscreen: () => void;
  onToggleHelp: () => void;
  onTogglePanel: () => void;
  fullscreenAvailable: boolean;
  helpOpen: boolean;
  panelOpen: boolean;
  /** So the owner can restore focus to the panel trigger on close. */
  panelButtonRef?: React.Ref<HTMLButtonElement>;
}

export function ViewerDock({
  onReset,
  onFrame,
  onZoomIn,
  onZoomOut,
  onScreenshot,
  onFullscreen,
  onToggleHelp,
  onTogglePanel,
  fullscreenAvailable,
  helpOpen,
  panelOpen,
  panelButtonRef,
}: ViewerDockProps) {
  const isWireframe = useViewerStore((s) => s.isWireframe);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const showGrid = useViewerStore((s) => s.showGrid);
  const showAxes = useViewerStore((s) => s.showAxes);
  const orbitEnabled = useViewerStore((s) => s.orbitEnabled);
  const environment = useViewerStore((s) => s.environment);
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe);
  const toggleAutoRotate = useViewerStore((s) => s.toggleAutoRotate);
  const toggleGrid = useViewerStore((s) => s.toggleGrid);
  const toggleAxes = useViewerStore((s) => s.toggleAxes);
  const toggleOrbit = useViewerStore((s) => s.toggleOrbit);
  const cycleEnvironment = useViewerStore((s) => s.cycleEnvironment);

  const nextEnv =
    environment === 'studio'
      ? 'midnight'
      : environment === 'midnight'
        ? 'sunset'
        : 'studio';

  return (
    <div
      role="toolbar"
      aria-label="Viewer controls"
className="pointer-events-auto flex max-w-full items-center
        justify-center gap-1.5 rounded-panel border border-line bg-overlay-panel/90 p-1.5 shadow-lift backdrop-blur
        max-lg:justify-start max-lg:overflow-x-auto"
    >
      <IconButton label="Reset camera" shortcut="R" onClick={onReset}>
        {ICONS.reset}
      </IconButton>
      <IconButton label="Frame model" shortcut="F" onClick={onFrame}>
        {ICONS.frame}
      </IconButton>
      <IconButton label="Zoom in" shortcut="+" onClick={onZoomIn}>
        {ICONS.zoomIn}
      </IconButton>
      <IconButton label="Zoom out" shortcut="-" onClick={onZoomOut}>
        {ICONS.zoomOut}
      </IconButton>
      <IconButton
        label="Auto-rotate"
        shortcut="A"
        active={autoRotate}
        onClick={toggleAutoRotate}
      >
        {ICONS.autoRotate}
      </IconButton>
      <IconButton
        label={orbitEnabled ? 'Orbit on (drag to rotate)' : 'Orbit off (camera locked)'}
        shortcut="O"
        active={orbitEnabled}
        onClick={toggleOrbit}
      >
        {ICONS.orbit}
      </IconButton>
      <IconButton label="Grid" shortcut="G" active={showGrid} onClick={toggleGrid}>
        {ICONS.grid}
      </IconButton>
      <IconButton label="Axes" shortcut="X" active={showAxes} onClick={toggleAxes}>
        {ICONS.axes}
      </IconButton>
      <IconButton
        label="Wireframe"
        shortcut="W"
        active={isWireframe}
        onClick={toggleWireframe}
      >
        {ICONS.wireframe}
      </IconButton>
      <IconButton
        label={`Background: ${ENV_LABELS[environment]} (switch to ${ENV_LABELS[nextEnv as EnvironmentPreset]})`}
        shortcut="B"
        onClick={cycleEnvironment}
      >
        {ICONS.background}
      </IconButton>
      <IconButton label="Save screenshot" shortcut="S" onClick={onScreenshot}>
        {ICONS.screenshot}
      </IconButton>
      <IconButton
        label={fullscreenAvailable ? 'Fullscreen' : 'Fullscreen not supported'}
        shortcut="⇧F"
        disabled={!fullscreenAvailable}
        onClick={onFullscreen}
      >
        {ICONS.fullscreen}
      </IconButton>
      <IconButton
        label="Keyboard shortcuts"
        shortcut="?"
        active={helpOpen}
        onClick={onToggleHelp}
      >
        {ICONS.help}
      </IconButton>
      <IconButton
        label="Studio panel"
        active={panelOpen}
        expanded={panelOpen}
        onClick={onTogglePanel}
        buttonRef={panelButtonRef}
      >
        {ICONS.panel}
      </IconButton>
    </div>
  );
}


