import { CARD_GRID_CLASS } from '@/components/ui/cardLayout';
import { Skeleton } from '@/components/ui/Skeleton';

export function GallerySkeleton() {
  return (
    <div className={CARD_GRID_CLASS} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-card border border-line bg-surface motion-reduce:animate-none"
        >
          <div className="aspect-[4/3] w-full border-b border-line bg-elevated" />
          <div className="p-4">
            <Skeleton className="h-4 w-3/4 rounded bg-interactive" />
            <Skeleton className="mt-2.5 h-3 w-full rounded bg-interactive/70" />
            <Skeleton className="mt-2 h-3 w-2/3 rounded bg-interactive/70" />
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Skeleton className="h-3 w-10 rounded bg-interactive/60" />
              <Skeleton className="h-3 w-16 rounded bg-interactive/60" />
              <Skeleton className="ml-auto h-3 w-12 rounded bg-interactive/60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
