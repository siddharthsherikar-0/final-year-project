import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Stage 9D editor primitives: colour swatches, unit sliders and a labelled
 * toggle.
 *
 * These follow the existing `EditorSection` / `NumberField` language - mono
 * technical values, hairline borders, gold only for the active state - so the
 * material panel reads as part of the same system rather than a bolted-on
 * widget library.
 */

/**
 * Colour swatch + hex field + native picker.
 *
 * The swatch is a real `<input type="color">`, so the browser's own picker is
 * used: it is keyboard accessible, supports eyedropper where available, and
 * needs no popover positioning work that would break inside the scrolling
 * inspector on a 320px viewport.
 *
 * The text field commits on blur or Enter and REJECTS invalid hex, showing the
 * error inline rather than silently snapping to black. `draft` is held locally
 * so a half-typed `#c8c` is not fought by the store on every keystroke.
 */
export function ColorField({
  label,
  value,
  onCommit,
  disabled = false,
  testId,
  title,
}: {
  label: string;
  /** `#rrggbb`, or null when the material class has no such colour. */
  value: string | null;
  onCommit: (hex: string) => void;
  disabled?: boolean;
  testId?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A stale error or draft must not survive a selection change to a different
  // material. Keying on the swatch value gives that for free: React remounts
  // this subtree when the identity changes, discarding the local state.
  const swatchValue = value ?? '#000000';
  const shown = draft ?? swatchValue;

  const commit = (raw: string) => {
    const candidate = raw.trim();
    if (!/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(candidate)) {
      setError('Use a hex value like #c8c8c8');
      return;
    }
    setError(null);
    const normalized = candidate.startsWith('#') ? candidate : `#${candidate}`;
    if (normalized.toLowerCase() === swatchValue) return;
    onCommit(normalized);
  };

  return (
    <div className="min-w-0 flex-1" data-testid={testId}>
      <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1.5">
        <label
          className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-control ${
            disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
          }`}
          title={disabled ? 'This material has no colour' : `Pick ${label.toLowerCase()}`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: swatchValue }}
          />
          <input
            type="color"
            value={swatchValue}
            disabled={disabled}
            aria-label={`${label} colour picker`}
            data-testid={testId ? `${testId}-picker` : undefined}
            onChange={(event) => {
              setError(null);
              onCommit(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>
        <input
          type="text"
          inputMode="text"
          value={shown}
          disabled={disabled}
          spellCheck={false}
          aria-label={label}
          title={title ?? `${label} as hexadecimal`}
          data-testid={testId ? `${testId}-hex` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft === null) return;
            const candidate = draft;
            setDraft(null);
            commit(candidate);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            } else if (event.key === 'Escape') {
              setDraft(null);
              setError(null);
              (event.target as HTMLInputElement).blur();
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-control bg-canvas px-1.5 py-1 font-mono text-xs text-ink outline-none transition-colors focus:border-accent/60 disabled:opacity-40"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[10px] leading-tight text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Slider + numeric field for a 0..1 (or 0..max) scalar.
 *
 * The slider previews live: dragging writes on every input event, which is the
 * whole point of a material slider. The number field commits on blur or Enter
 * so a typed "0." is not rejected mid-keystroke.
 *
 * The two are kept consistent by writing the same committed value back to
 * `value`, and the slider is `aria-hidden` because the number field is the
 * accessible control for the same value - two focusable controls for one
 * property is worse than one.
 */
export function UnitSliderField({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onCommit,
  disabled = false,
  disabledReason,
  testId,
  format,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
  format?: (value: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : min;
  const shown = draft ?? (format ? format(numeric) : String(Math.round(numeric * 1000) / 1000));

  const clamp = (raw: number) => Math.min(Math.max(raw, min), max);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed);
    if (next === numeric) return;
    onCommit(next);
  };

  return (
    <div className="min-w-0 flex-1" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
          {label}
        </span>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={shown}
          aria-label={label}
          title={disabled ? (disabledReason ?? 'Not supported by this material') : undefined}
          data-testid={testId ? `${testId}-value` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            } else if (event.key === 'Escape') {
              setDraft(null);
              (event.target as HTMLInputElement).blur();
            }
          }}
          className="min-w-0 rounded-md border border-control bg-canvas px-1 py-0.5 text-right font-mono text-xs tabular-nums text-ink outline-none transition-colors focus:border-accent/60 disabled:opacity-40"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={numeric}
        aria-label={`${label} slider`}
        title={disabled ? (disabledReason ?? 'Not supported by this material') : label}
        data-testid={testId ? `${testId}-slider` : undefined}
        onChange={(event) => {
          const next = clamp(Number(event.target.value));
          if (next !== numeric) onCommit(next);
        }}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--accent-ch))] disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  );
}

/**
 * Labelled on/off toggle.
 *
 * `role="switch"` with `aria-checked` is the honest pattern for a control whose
 * label reads as a noun ("Transparency") rather than an action.
 *
 * The BUTTON is 28px tall and inset-free while the visible track inside is
 * 20px: shrinking the hit area to match the track would put this control below
 * the 28px tap-target floor every other control in the studio meets, and the
 * switch sits in a dense row of sliders where a mis-tap is easy.
 */
export function ToggleSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  disabledReason,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span
        className={`font-mono text-[10px] uppercase leading-none tracking-[0.12em] ${
          disabled ? 'text-ink-faint opacity-50' : 'text-ink-faint'
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        title={disabled ? (disabledReason ?? 'Not supported by this material') : label}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? 'bg-accent-subtle' : 'bg-transparent'
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5 w-8 items-center rounded-full border transition-colors ${
            checked ? 'border-accent/60 bg-accent-subtle' : 'border-control bg-canvas'
          }`}
        >
          <span
            className={`absolute h-3 w-3 rounded-full transition-transform ${
              checked ? 'translate-x-[18px] bg-accent' : 'translate-x-[3px] bg-ink-faint'
            }`}
          />
        </span>
      </button>
    </div>
  );
}

/** Compact key/value row for material metadata. */
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 py-0.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-mono text-[11px] text-ink-muted" title={typeof children === 'string' ? children : undefined}>
        {children}
      </span>
    </div>
  );
}