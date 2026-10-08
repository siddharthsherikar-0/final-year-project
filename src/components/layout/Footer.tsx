import { useLocation } from 'react-router-dom';
import { NavItemLink } from '@/components/layout/NavItemLink';
import { APP_NAME } from '@/config/constants';
import {
  ANONYMOUS_NAV,
  FOOTER_CREDIT,
  FOOTER_NAV,
  navItemsFor,
} from '@/config/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

export function Footer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  const utilityItems = navItemsFor(isAuthenticated, FOOTER_NAV);
  const anonymousItems = navItemsFor(isAuthenticated, ANONYMOUS_NAV);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p className="font-display text-base font-semibold text-ink">
              {APP_NAME}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
              Browse, inspect and showcase GLB/GLoTF models in an interactive 3D
              studio — right in your browser.
            </p>
          </div>

          <nav aria-label="Explore links" className="flex flex-col items-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Explore
            </p>
            {utilityItems.map((item) => (
              <NavItemLink
                key={item.id}
                item={item}
                pathname={location.pathname}
                variant="footer"
              />
            ))}
          </nav>

          {anonymousItems.length > 0 && (
            <nav aria-label="Account links" className="flex flex-col items-start">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Account
              </p>
              {anonymousItems.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  pathname={location.pathname}
                  variant="footer"
                />
              ))}
            </nav>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Studio
            </p>
            <p className="max-w-[16rem] text-sm leading-relaxed text-ink-muted">
              Real-time WebGL viewer with orbit, framing, animation playback and
              screenshot export.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            © {year} {APP_NAME}. Final-year diploma project.
          </p>
          <p className="text-xs text-ink-faint">{FOOTER_CREDIT}</p>
        </div>
      </div>
    </footer>
  );
}
