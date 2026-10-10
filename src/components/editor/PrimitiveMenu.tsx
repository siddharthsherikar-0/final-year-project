import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { PRIMITIVE_DEFS, PRIMITIVE_KINDS } from '@/editor/primitives';
import { createPrimitiveAction } from '@/editor/editorCommands';

/**
 * Primitive creation menu.
 *
 * A real menu of the six supported primitives. Each item creates genuine
 * geometry through the working scene - there are no placeholder objects.
 *
 * Keyboard and assistive-technology behaviour follows the button/menu pattern:
 * `aria-haspopup`, `aria-expanded`, Escape to dismiss, focus returns to the
 * trigger, and the menu is dismissed on outside pointer interaction.
 */

const ICONS: Record<string, string> = {
  box: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4m0 0l8-4m-8 4v10',
  sphere: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c4 3 4 15 0 18m0-18c-4 3-4 15 0 18',
  plane: 'M3 15l9-5 9 5-9 5z',
  cylinder: 'M6 6h12v12H6zM6 6a6 2 0 0012 0M6 18a6 2 0 0012 0',
  cone: 'M12 3l7 15H5zM12 3v15',
  torus: 'M12 7c-4 0-7 2.2-7 5s3 5 7 5 7-2.2 7-5-3-5-7-5zm0 3.2c2.2 0 4 1 4 1.8s-1.8 1.8-4 1.8-4-1-4-1.8 1.8-1.8 4-1.8z',
};

export function PrimitiveMenu() {
  const open = useEditorStore((s) => s.primitiveMenuOpen);
  const setOpen = useEditorStore((s) => s.setPrimitiveMenuOpen);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(
    (returnFocus = false) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  // Outside click and Escape dismissal.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpen, close]);

  const create = useCallback(
    (kind: (typeof PRIMITIVE_KINDS)[number]) => {
      createPrimitiveAction(kind);
      close(true);
    },
    [close],
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add primitive"
        title="Add a primitive"
        className={`inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-ring ${
          open
            ? 'border-accent/60 bg-accent-subtle text-accent'
            : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Add
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Primitive"
          data-testid="primitive-menu"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-52 overflow-hidden rounded-md border border-line bg-elevated p-1 shadow-lift"
        >
          {PRIMITIVE_KINDS.map((kind) => {
            const def = PRIMITIVE_DEFS[kind];
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => create(kind)}
                title={def.hint}
                data-testid={`primitive-${kind}`}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-muted transition-colors hover:bg-interactive hover:text-ink focus-ring"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path d={ICONS[kind] ?? ICONS.box} strokeLinejoin="round" />
                </svg>
                <span className="truncate">{def.label}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">
                  {Object.keys(def.defaults).length}p
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}