import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Editor primitives.
 *
 * Small shared pieces for the Stage 9B workspace so the toolbar, hierarchy and
 * inspector read as one system: mono technical values, hairline separators,
 * restrained gold for the active state. No cards, no glow, no decoration.
 */

export function EditorSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          {title}
        </h3>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function ToolbarButton({
  label,
  onClick,
  active = false,
  pressed,
  disabled = false,
  title,
  testId,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      title={title ?? label}
      className={`inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-accent/60 bg-accent-subtle text-accent'
          : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
      }`}
    >
      {children ?? label}
    </button>
  );
}

/**
 * Numeric input for a single transform component.
 *
 * Keeps its own draft while focused so typing "-1." or "1e" is not fought by
 * the store, and commits on blur or Enter.
 */
export function NumberField({
  label,
  value,
  onCommit,
  disabled = false,
  step = 0.1,
  testId,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
  step?: number;
  testId?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="w-3 shrink-0 font-mono text-[11px] uppercase text-ink-faint">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        data-testid={testId}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
        className="min-w-0 flex-1 rounded-md border border-control bg-canvas px-1.5 py-1 font-mono text-xs tabular-nums text-ink outline-none transition-colors focus:border-accent/60 disabled:opacity-40"
      />
    </label>
  );
}

export function MonoValue({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs tabular-nums text-ink">{children}</span>;
}

/**
 * Draft-and-commit numeric field.
 *
 * Used where a keystroke must NOT trigger expensive work - regenerating a torus
 * on every character would rebuild tens of thousands of vertices per keypress.
 * The field keeps a local draft while focused and commits on blur or Enter, so
 * intermediate states such as "1." or "-" are editable.
 */
export function DraftNumberField({
  label,
  value,
  onCommit,
  step = 0.1,
  testId,
  title,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  step?: number;
  testId?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : '0');

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1" title={title}>
      <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={shown}
        data-testid={testId}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          } else if (event.key === 'Escape') {
            // Abandon the edit rather than committing a half-typed value.
            setDraft(null);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="min-w-0 rounded-md border border-control bg-canvas px-1.5 py-1 font-mono text-xs tabular-nums text-ink outline-none transition-colors focus:border-accent/60"
      />
    </label>
  );
}
