import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-dashed border-control/50 bg-surface px-6 py-14 text-center">
      <div className="studio-grid absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="relative">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {description && (
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
