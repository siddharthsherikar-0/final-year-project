import type { ReactNode } from 'react';

/**
 * Editorial page header.
 *
 * Hierarchy is carried by type scale and whitespace rather than a bordered
 * panel: an optional technical eyebrow, an expressive display title, a short
 * description, and a page-level action.
 *
 * `testId` keeps existing page anchors addressable after the recomposition.
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  /** Short technical line rendered in mono above the title. */
  eyebrow?: string;
  action?: ReactNode;
  /** Rendered under the header - compressed metadata, not another card. */
  meta?: ReactNode;
  testId?: string;
  headingLevel?: 1 | 2;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  meta,
  testId,
  headingLevel = 1,
}: PageHeaderProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <div className={testId ? undefined : undefined} data-testid={testId}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              {eyebrow}
            </p>
          )}
          <Heading className="mt-2 font-display text-title font-bold text-ink">
            {title}
          </Heading>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
              {description}
            </p>
          )}
          {meta && <div className="mt-4">{meta}</div>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  testId?: string;
}

/** Quiet section heading: no container, hierarchy from type and spacing. */
export function SectionHeader({
  title,
  description,
  href,
  linkLabel,
  testId,
}: SectionHeaderProps) {
  return (
    <div
      className="mb-6 flex flex-wrap items-end justify-between gap-3"
      data-testid={testId}
    >
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
        )}
      </div>

      {href && linkLabel && (
        <a
          href={href}
          className="shrink-0 rounded-sm text-sm font-medium text-ink-muted underline decoration-line underline-offset-4 transition-colors duration-fast hover:text-ink hover:decoration-ink-faint focus-ring"
        >
          {linkLabel}
          <span aria-hidden="true"> →</span>
        </a>
      )}
    </div>
  );
}

interface StatStripProps {
  items: { testId: string; label: string; value: number; hint?: string }[];
}

/**
 * Compressed statistics.
 *
 * Replaces three dashboard stat cards: one quiet line of facts in mono type,
 * separated by spacing instead of borders, so numbers read as context rather
 * than as the page's main content.
 */
export function StatStrip({ items }: StatStripProps) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
      {items.map((item) => (
        <div key={item.testId} className="flex items-baseline gap-2">
          <dt className="text-xs uppercase tracking-wider text-ink-faint">
            {item.label}
          </dt>
          <dd>
            <span
              className="font-mono text-lg font-medium tabular-nums text-ink"
              data-testid={`${item.testId}-value`}
            >
              {item.value.toLocaleString('en-US')}
            </span>
            {item.hint && (
              <span className="ml-2 text-xs text-ink-faint">{item.hint}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}