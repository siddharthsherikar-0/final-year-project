/**
 * Card grid scales — one gap and one column rhythm for every content grid.
 *
 * Density ladder (verified at 320 / 375 / 768 / 1024 / 1440 / 1920):
 * - 1 column below sm (640) so 320px cards are never crushed
 * - 2 columns at sm (>=640)
 * - 3 columns at lg (>=1024) for browsable galleries
 * - 4 columns at xl (>=1280) only for wide viewports, so cards stay >=240px
 *
 * `gap` is constant per breakpoint instead of jumping between gap-4 and gap-6.
 */

/** Browsable galleries: ModelGrid, My Models, Favorites. */
export const CARD_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4';

/** Featured rails that always show exactly four items. */
export const CARD_RAIL_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4';

/** Related models on the detail page (three items). */
export const CARD_RELATED_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3';

/**
 * Grid class for rails whose length depends on real data (recent uploads,
 * favorites, recently viewed).
 *
 * A fixed four-column rail left a single item marooned beside three empty
 * columns, which read as an unfinished page. The column count follows the item
 * count instead, so a short library looks deliberate at every breakpoint.
 */
export function railGridClass(count: number): string {
  if (count <= 1) return 'grid grid-cols-1 gap-4 sm:max-w-md';
  if (count === 2) return 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5';
  if (count === 3) return 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3';
  return CARD_RAIL_GRID_CLASS;
}
