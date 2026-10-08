/**
 * Dependency-free class combiner.
 *
 * Flattens strings, arrays, and conditional objects into a class string.
 * Deliberately does NOT resolve conflicting Tailwind utilities (that would
 * require `tailwind-merge`, which this repository does not depend on): when two
 * classes target the same CSS property, the one that wins is decided by
 * stylesheet order, not by argument order. Callers that need an override must
 * pass it through the component's variant/size props rather than by appending
 * `className`.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

function collect(value: ClassValue, out: string[]): void {
  if (!value) return;

  if (typeof value === 'string' || typeof value === 'number') {
    const trimmed = String(value).trim();
    if (trimmed) out.push(trimmed);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collect(item, out);
    return;
  }

  for (const [className, enabled] of Object.entries(value)) {
    if (enabled) collect(className, out);
  }
}

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) collect(value, classes);
  return classes.join(' ');
}
