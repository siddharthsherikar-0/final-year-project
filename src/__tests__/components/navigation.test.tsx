import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ANONYMOUS_NAV,
  FOOTER_NAV,
  PRIMARY_NAV,
  UPLOAD_ACTION,
  USER_MENU_NAV,
  isNavItemActive,
  navItemsFor,
} from '@/config/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuthStore } from '@/stores/useAuthStore';

const AUTH_STATE = {
  isAuthenticated: true,
  token: 'test-token',
  user: { id: 'u1', email: 'ada@studio.dev', name: 'Ada Lovelace' },
  error: null,
  isLoading: false,
};

function renderHeader(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header />
    </MemoryRouter>,
  );
}

function openMobileMenu() {
  const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });
  fireEvent.click(toggle);
  return {
    toggle,
    menu: screen.getByRole('navigation', { name: 'Mobile navigation' }),
  };
}

afterEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    token: null,
    user: null,
    error: null,
    isLoading: false,
  });
  document.body.style.overflow = '';
});

describe('navigation metadata', () => {
  it('exposes gallery, favorites, my models and dashboard in that order', () => {
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      'gallery',
      'favorites',
      'my-models',
      'dashboard',
    ]);
  });

  it('keeps the gallery label pointing at the root route', () => {
    const gallery = PRIMARY_NAV[0];
    expect(gallery?.to).toBe('/');
    expect(gallery?.label).toBe('Gallery');
  });

  it('marks account-scoped items as authenticated-only', () => {
    expect(
      PRIMARY_NAV.filter((item) => item.visibility === 'authenticated').map((item) => item.id),
    ).toEqual(['favorites', 'my-models', 'dashboard']);
    expect(UPLOAD_ACTION.visibility).toBe('authenticated');
    expect(ANONYMOUS_NAV.every((item) => item.visibility === 'anonymous')).toBe(true);
  });

  it('filters items by auth state', () => {
    expect(navItemsFor(false, PRIMARY_NAV).map((item) => item.id)).toEqual(['gallery']);
    expect(navItemsFor(true, PRIMARY_NAV)).toHaveLength(PRIMARY_NAV.length);
    expect(navItemsFor(true, ANONYMOUS_NAV)).toHaveLength(0);
    expect(navItemsFor(false, ANONYMOUS_NAV)).toHaveLength(2);
  });

  it('reuses primary and user-menu definitions instead of duplicating routes', () => {
    expect(FOOTER_NAV.every((item) => PRIMARY_NAV.includes(item))).toBe(true);
    expect(USER_MENU_NAV.every((item) => PRIMARY_NAV.includes(item))).toBe(true);
    expect(FOOTER_NAV.map((item) => item.id)).not.toContain('dashboard');
  });

  it('matches the root route exactly', () => {
    const gallery = PRIMARY_NAV[0]!;
    expect(isNavItemActive(gallery, '/')).toBe(true);
    expect(isNavItemActive(gallery, '/favorites')).toBe(false);
  });

  it('keeps Gallery active for model detail and studio routes', () => {
    const gallery = PRIMARY_NAV[0]!;
    expect(isNavItemActive(gallery, '/model/abc-123')).toBe(true);
    expect(isNavItemActive(gallery, '/viewer/abc-123')).toBe(true);
  });

  it('matches nested paths below a declared section', () => {
    const favorites = PRIMARY_NAV[1]!;
    const myModels = PRIMARY_NAV[2]!;
    expect(isNavItemActive(favorites, '/favorites')).toBe(true);
    expect(isNavItemActive(favorites, '/favorites/anything')).toBe(true);
    expect(isNavItemActive(favorites, '/my-models')).toBe(false);
    expect(isNavItemActive(myModels, '/my-models')).toBe(true);
  });

  it('activates no primary item on the upload route', () => {
    expect(PRIMARY_NAV.some((item) => isNavItemActive(item, '/upload'))).toBe(false);
  });

  it('activates exactly one primary item per application route', () => {
    const routes = ['/', '/favorites', '/my-models', '/dashboard', '/model/x', '/viewer/x'];
    for (const route of routes) {
      const active = PRIMARY_NAV.filter((item) => isNavItemActive(item, route));
      expect(active).toHaveLength(1);
    }
  });
});

describe('Header desktop navigation', () => {
  it('renders the shared navigation links from configuration', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/');
    expect(within(nav).queryByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(within(nav).queryByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });

  it('marks the current route with aria-current', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader('/favorites');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Favorites' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Gallery' })).not.toHaveAttribute('aria-current');
  });

  it('keeps Gallery current on nested model routes', () => {
    renderHeader('/model/abc-123');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Gallery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows exactly one upload action while signed in', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();
    expect(screen.getAllByRole('link', { name: 'Upload' })).toHaveLength(1);
  });

  it('opens an account menu with neutral logout', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();

    const trigger = screen.getByRole('button', { name: /Ada Lovelace/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(within(menu).getByRole('menuitem', { name: 'My Models' })).toHaveAttribute(
      'href',
      '/my-models',
    );
    const logout = within(menu).getByRole('menuitem', { name: 'Logout' });
    expect(logout.className).not.toMatch(/text-(danger|error|red)/);
  });

  it('closes the account menu on Escape and returns focus to its trigger', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();

    const trigger = screen.getByRole('button', { name: /Ada Lovelace/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Account' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the account menu when clicking outside', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /Ada Lovelace/i }));
    expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('logs out from the account menu', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /Ada Lovelace/i }));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Logout' }));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('Header mobile menu accessibility', () => {
  it('keeps the toggle wired to the rendered menu', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    const { menu } = openMobileMenu();
    expect(menu).toHaveAttribute('id', controls!);
  });

  it('moves focus to the first item when opened', () => {
    renderHeader();
    const { menu } = openMobileMenu();
    expect(document.activeElement).toBe(within(menu).getByRole('link', { name: 'Gallery' }));
  });

  it('traps Tab inside the menu and wraps in both directions', () => {
    renderHeader();
    const { menu } = openMobileMenu();

    const focusables = [
      ...menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and restores focus to the toggle', () => {
    renderHeader();
    const { toggle } = openMobileMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
  });

  it('closes after following a link', () => {
    renderHeader();
    const { menu } = openMobileMenu();

    fireEvent.click(within(menu).getByRole('link', { name: 'Gallery' }));

    expect(
      screen.queryByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeInTheDocument();
  });

  it('locks page scrolling while open and restores the previous value', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderHeader();

    openMobileMenu();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('scroll');

    openMobileMenu();
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('gives every menu row a 44px minimum target', () => {
    renderHeader();
    const { menu } = openMobileMenu();
    for (const link of menu.querySelectorAll('a[href]')) {
      expect(link.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('offers auth actions to signed-in users and a neutral logout', () => {
    useAuthStore.setState(AUTH_STATE);
    renderHeader();
    const { menu } = openMobileMenu();

    expect(within(menu).getByRole('link', { name: 'Upload' })).toHaveAttribute('href', '/upload');
    expect(within(menu).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    const logout = within(menu).getByRole('button', { name: 'Logout' });
    expect(logout.className).not.toMatch(/text-(danger|error|red)/);
  });

  it('shows login and register to signed-out visitors', () => {
    renderHeader();
    const { menu } = openMobileMenu();
    expect(within(menu).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(within(menu).getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(within(menu).queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });
});

describe('Footer', () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
  }

  it('reuses the shared navigation definitions', () => {
    useAuthStore.setState(AUTH_STATE);
    renderFooter();
    const explore = screen.getByRole('navigation', { name: 'Explore links' });
    expect(within(explore).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/');
    expect(within(explore).getByRole('link', { name: 'Favorites' })).toHaveAttribute(
      'href',
      '/favorites',
    );
    expect(within(explore).getByRole('link', { name: 'My Models' })).toHaveAttribute(
      'href',
      '/my-models',
    );
  });

  it('marks the current section as active', () => {
    useAuthStore.setState(AUTH_STATE);
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <Footer />
      </MemoryRouter>,
    );
    const explore = screen.getByRole('navigation', { name: 'Explore links' });
    expect(within(explore).getByRole('link', { name: 'Favorites' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(explore).getByRole('link', { name: 'Gallery' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('offers entry points while signed out and personal sections while signed in', () => {
    const { unmount } = renderFooter();
    const anonymousExplore = screen.getByRole('navigation', { name: 'Explore links' });
    expect(within(anonymousExplore).getByRole('link', { name: 'Gallery' })).toBeInTheDocument();
    expect(within(anonymousExplore).queryByRole('link', { name: 'Favorites' })).toBeNull();
    expect(within(anonymousExplore).queryByRole('link', { name: 'My Models' })).toBeNull();
    expect(
      within(screen.getByRole('navigation', { name: 'Account links' })).getByRole('link', {
        name: 'Login',
      }),
    ).toBeInTheDocument();
    unmount();

    useAuthStore.setState(AUTH_STATE);
    renderFooter();
    expect(screen.getByRole('link', { name: 'My Models' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Account links' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('does not duplicate the upload action or a logout control', () => {
    useAuthStore.setState(AUTH_STATE);
    renderFooter();
    expect(screen.queryByRole('link', { name: 'Upload' })).toBeNull();
    expect(screen.queryByRole('button', { name: /logout/i })).toBeNull();
  });

  it('keeps the project credit visible', () => {
    renderFooter();
    expect(screen.getByText(/final-year diploma project/i)).toBeInTheDocument();
  });
});
