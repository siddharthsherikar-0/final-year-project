import { SHORTCUTS } from './viewerUtils';

interface ViewerShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export function ViewerShortcuts({ open, onClose }: ViewerShortcutsProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-bg/75 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-sm rounded-panel border border-line bg-surface p-5 shadow-lift"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close shortcuts"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-elevated text-ink-muted transition-colors hover:bg-line hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <dl className="mt-3 divide-y divide-line">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-xs text-ink-muted">{shortcut.label}</dt>
              <dd>
                <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-ink">
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
