import { Skeleton } from '@/components/ui/Skeleton';
import { CARD_RAIL_GRID_CLASS } from '@/components/ui/cardLayout';

export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      data-testid="dashboard-skeleton"
      className="space-y-6"
    >
      <div className="rounded-panel border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:flex sm:flex-wrap sm:gap-4">
        <Skeleton className="h-20 w-full rounded-card sm:w-64" />
        <Skeleton className="h-20 w-full rounded-card sm:w-64" />
        <Skeleton className="h-20 w-full rounded-card sm:w-64" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-44" />
        <div className={CARD_RAIL_GRID_CLASS}>
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    </div>
  );
}
