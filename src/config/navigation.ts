/**
 * Single source of truth for site navigation.
 *
 * Components render from these definitions instead of repeating route labels
 * and hrefs. Active-state matching is centralized here so nested routes
 * (model detail, studio viewer) can keep the correct item active without
 * scattering pathname checks through the UI.
 */

/** Who can see the item in navigation. */
export type NavVisibility =
  /** Everyone, signed in or not. */
  | 'public'
  /** Signed-in visitors only. */
  | 'authenticated'
  /** Signed-out visitors only. */
  | 'anonymous';

export interface NavItem {
  /** Stable id, used for tests and keys. */
  id: string;
  label: string;
  /** Route the item links to. */
  to: string;
  /**
   * Pathnames that keep this item active. An entry matches the exact pathname
   * and anything nested below it (`/model` also matches `/model/:id`), while
   * `/` matches only the site root.
   */
  matches: string[];
  visibility: NavVisibility;
}

/** Primary application navigation (desktop bar + mobile sheet). */
export const PRIMARY_NAV: NavItem[] = [
  {
    id: 'gallery',
    label: 'Gallery',
    to: '/',
    // The gallery is the site root, and browsing a model or opening the studio
    // is still "Gallery" in this product's information architecture.
    matches: ['/', '/model', '/viewer'],
    visibility: 'public',
  },
  {
    id: 'favorites',
    label: 'Favorites',
    to: '/favorites',
    matches: ['/favorites'],
    visibility: 'authenticated',
  },
  {
    id: 'my-models',
    label: 'My Models',
    to: '/my-models',
    matches: ['/my-models'],
    visibility: 'authenticated',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    matches: ['/dashboard'],
    visibility: 'authenticated',
  },
];

/** Quiet utility links repeated in the footer (no dashboard section). */
export const FOOTER_NAV: NavItem[] = PRIMARY_NAV.filter((item) =>
  ['gallery', 'favorites', 'my-models'].includes(item.id),
);

/** Entry points for signed-out visitors. */
export const ANONYMOUS_NAV: NavItem[] = [
  { id: 'login', label: 'Login', to: '/login', matches: ['/login'], visibility: 'anonymous' },
  {
    id: 'register',
    label: 'Register',
    to: '/register',
    matches: ['/register'],
    visibility: 'anonymous',
  },
];

/** The single global primary action (header only). */
export const UPLOAD_ACTION: NavItem = {
  id: 'upload',
  label: 'Upload',
  to: '/upload',
  matches: ['/upload'],
  visibility: 'authenticated',
};

/** Items inside the desktop account menu — the same objects as the primary nav. */
export const USER_MENU_NAV: NavItem[] = PRIMARY_NAV.filter((item) =>
  ['dashboard', 'my-models'].includes(item.id),
);

/** Non-route footer content, kept explicit rather than faked as nav items. */
export const FOOTER_CREDIT = 'React · TypeScript · Three.js · Express · Prisma';

export function navItemsFor(isAuthenticated: boolean, items: NavItem[]): NavItem[] {
  return items.filter((item) => {
    if (item.visibility === 'authenticated') return isAuthenticated;
    if (item.visibility === 'anonymous') return !isAuthenticated;
    return true;
  });
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.matches.some((candidate) => {
    if (candidate === '/') return pathname === '/';
    return pathname === candidate || pathname.startsWith(`${candidate}/`);
  });
}
