import { useProgress } from '@react-three/drei';
import { Button } from '@/components/ui/Button';

interface ViewerOverlayProps {
  ready: boolean;
  error: string | null;
  contextLost?: boolean;
  modelName?: string;
}

function MessageCard({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-elevated px-6 py-5 text-center shadow-lift">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {detail && <p className="mt-1 max-w-xs text-xs text-ink-muted">{detail}</p>}
      {action}
    </div>
  );
}

export function ViewerOverlay({
  ready,
  error,
  contextLost,
  modelName,
}: ViewerOverlayProps) {
  const { progress, active } = useProgress();

  if (error) {
    return (
      <div
        role="alert"
        className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80 p-4"
      >
        <MessageCard
          title="Failed to render model"
          detail={error}
          action={
            modelName ? (
              <p className="mt-2 text-xs text-ink-faint">{modelName}</p>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (contextLost) {
    return (
      <div
        role="alert"
        className="absolute inset-0 z-10 flex items-center justify-center bg-bg/85 p-4"
      >
        <MessageCard
          title="Graphics context lost"
          detail="Restoring the 3D renderer. If nothing happens, reload the page."
          action={
            <Button
              variant="secondary"
              className="mt-3 text-xs"
              onClick={() => window.location.reload()}
            >
              Reload viewer
            </Button>
          }
        />
      </div>
    );
  }

  if (ready) return null;

  const percent = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/70"
    >
      <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-info transition-[width] duration-base"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-ink-muted" data-testid="viewer-progress-label">
        {active
          ? `Loading ${modelName ?? 'model'}… ${percent}%`
          : `Preparing ${modelName ?? 'model'}…`}
      </p>
    </div>
  );
}
