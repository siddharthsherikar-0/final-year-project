import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '@/components/layout/BrandMark';
import { NavItemLink } from '@/components/layout/NavItemLink';
import {
  ANONYMOUS_NAV,
  PRIMARY_NAV,
  UPLOAD_ACTION,
  USER_MENU_NAV,
  navItemsFor,
} from '@/config/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

const MENU_ID = 'mobile-menu';

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function Header() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(location.pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Adjust state during render (React's documented pattern for reacting to a
  // changed input) so any route change dismisses the transient surfaces without
  // a set-state-in-effect pass.
  if (lastPathname !== location.pathname) {
    setLastPathname(location.pathname);
    setMenuOpen(false);
    setUserMenuOpen(false);
  }

  const closeMenu = useCallback((restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Mobile sheet: focus management, focus trap, Escape, and scroll lock.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const initial = focusableWithin(menuRef.current)[0] ?? menuRef.current;
    initial?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableWithin(menuRef.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen, closeMenu]);

  // Desktop user menu: Escape and outside-click dismissal.
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setUserMenuOpen(false);
        userMenuRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const primaryItems = navItemsFor(isAuthenticated, PRIMARY_NAV);
  const anonymousItems = navItemsFor(isAuthenticated, ANONYMOUS_NAV);
  const initials = (user?.name ?? '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center rounded-md text-ink transition-opacity hover:opacity-80 focus-ring"
          aria-label="3D Model Viewer — home"
        >
          <BrandMark size="sm" />
        </Link>

        {/* Single navigation landmark: primary destinations plus the
            authenticated action cluster / anonymous entry points. */}
        <nav
          className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
          aria-label="Main navigation"
        >
          {primaryItems.map((item) => (
            <NavItemLink
              key={item.id}
              item={item}
              pathname={location.pathname}
              variant="desktop"
            />
          ))}

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={UPLOAD_ACTION.to}
                  aria-current={
                    location.pathname === UPLOAD_ACTION.to ? 'page' : undefined
                  }
                  data-nav-id={UPLOAD_ACTION.id}
                  className="inline-flex min-h-[40px] items-center rounded-md bg-accent px-3.5 text-sm font-medium text-on-accent transition-[background-color,transform] duration-base hover:bg-accent-hover active:translate-y-px focus-ring motion-reduce:transition-none"
                >
                  {UPLOAD_ACTION.label}
                </Link>

                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((open) => !open)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    aria-controls="user-menu"
                    className="flex min-h-[40px] items-center gap-2 rounded-md px-2 text-sm font-medium text-ink-muted transition-colors duration-fast hover:bg-interactive hover:text-ink focus-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-control bg-elevated text-[11px] font-semibold text-accent"
                    >
                      {initials || '?'}
                    </span>
                    <span className="max-w-[8rem] truncate text-ink">
                      {user?.name}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div
                      id="user-menu"
                      role="menu"
                      aria-label="Account"
                      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-card border border-control bg-overlay-panel p-1 shadow-lift"
                    >
                      <div className="border-b border-line px-3 pb-2 pt-2">
                        <p className="truncate text-sm font-medium text-ink">
                          {user?.name}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {user?.email}
                        </p>
                      </div>
                      {USER_MENU_NAV.map((item) => (
                        <Link
                          key={item.id}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-fast hover:bg-interactive hover:text-ink focus-ring"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex min-h-[40px] w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors duration-fast hover:bg-interactive hover:text-ink focus-ring"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              anonymousItems.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  pathname={location.pathname}
                  variant="desktop"
                />
              ))
            )}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            aria-label="Toggle navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink transition-colors duration-fast hover:bg-interactive focus-ring lg:hidden"
          >
            {menuOpen ? (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-line bg-canvas lg:hidden">
          <nav
            id={MENU_ID}
            ref={menuRef}
            aria-label="Mobile navigation"
            className="mx-auto max-w-7xl space-y-1 px-4 pb-4 pt-3 sm:px-6"
          >
            {primaryItems.map((item) => (
              <NavItemLink
                key={item.id}
                item={item}
                pathname={location.pathname}
                variant="menu"
                onNavigate={() => closeMenu(false)}
              />
            ))}

            {isAuthenticated ? (
              <>
                <Link
                  to={UPLOAD_ACTION.to}
                  onClick={() => closeMenu(false)}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-on-accent transition-[background-color,transform] duration-base hover:bg-accent-hover active:translate-y-px focus-ring motion-reduce:transition-none"
                >
                  {UPLOAD_ACTION.label}
                </Link>
                <div className="mt-2 border-t border-line pt-3">
                  <p className="px-3 pb-1 text-xs text-ink-muted">
                    Signed in as {user?.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu(false);
                      logout();
                    }}
                    className="flex min-h-[44px] w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium text-ink-muted transition-colors duration-fast hover:bg-elevated hover:text-ink focus-ring"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-2 space-y-1 border-t border-line pt-3">
                {anonymousItems.map((item) => (
                  <NavItemLink
                    key={item.id}
                    item={item}
                    pathname={location.pathname}
                    variant="menu"
                    onNavigate={() => closeMenu(false)}
                  />
                ))}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
