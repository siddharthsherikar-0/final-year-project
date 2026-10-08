import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModelStore } from '@/stores/useModelStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { ModelGallery } from '@/components/gallery/ModelGallery';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { FilterTag } from '@/components/search/FilterTag';
import { SortControls } from '@/components/search/SortControls';
import { Hero } from '@/components/landing/Hero';
import { LatestUploads } from '@/components/landing/LatestUploads';
import { CategoryNav } from '@/components/discovery/CategoryNav';
import { RecentlyViewed } from '@/components/discovery/RecentlyViewed';
import { MostFavorited } from '@/components/discovery/MostFavorited';
import { CATEGORIES, categoryLabel } from '@/config/categories';
import type { ModelCategory } from '@/types';

const CATEGORY_VALUES = new Set<string>(CATEGORIES.map((c) => c.value));

function parseCategoryParam(param: string | null): ModelCategory[] {
  if (!param) return [];
  return param
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ModelCategory => CATEGORY_VALUES.has(value));
}

function sameCategories(a: ModelCategory[], b: ModelCategory[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function HomePage() {
  const { models, isLoading, error, fetchModels } = useModelStore();
  const filterStore = useFilterStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('category');
  const selectedCategories = filterStore.selectedCategories;
  const prevParam = useRef<string | null | undefined>(undefined);
  const prevCategories = useRef<ModelCategory[] | undefined>(undefined);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  // Single bidirectional sync: whichever side changed since the last sync wins.
  // On first mount the URL wins (deep links apply; a plain URL clears categories).
  useEffect(() => {
    const paramChanged = prevParam.current !== categoryParam;
    const categoriesChanged = !sameCategories(
      prevCategories.current ?? [],
      selectedCategories,
    );
    prevParam.current = categoryParam;
    prevCategories.current = selectedCategories;

    if (!paramChanged && !categoriesChanged) return;

    const fromUrl = parseCategoryParam(categoryParam);
    const current = useFilterStore.getState().selectedCategories;

    if (paramChanged && categoriesChanged) {
      // Both "changed" on initial mount — URL is authoritative.
      if (!sameCategories(fromUrl, current)) {
        useFilterStore.setState({ selectedCategories: fromUrl });
      }
      return;
    }

    if (paramChanged) {
      // Deep link, back/forward, or a category link elsewhere.
      if (!sameCategories(fromUrl, current)) {
        useFilterStore.setState({ selectedCategories: fromUrl });
      }
      return;
    }

    // Store changed (filter chips, tags, clear) — mirror it into the URL.
    const desired =
      selectedCategories.length > 0 ? selectedCategories.join(',') : null;
    if (categoryParam !== desired) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (desired) {
            next.set('category', desired);
          } else {
            next.delete('category');
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [categoryParam, selectedCategories, setSearchParams]);

  const filteredModels = useMemo(() => {
    let result = [...models];

    if (filterStore.searchQuery) {
      const query = filterStore.searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    if (filterStore.selectedCategories.length > 0) {
      result = result.filter((m) =>
        filterStore.selectedCategories.includes(m.category),
      );
    }

    if (filterStore.selectedFormats.length > 0) {
      result = result.filter((m) =>
        filterStore.selectedFormats.includes(m.format),
      );
    }

    return result;
  }, [models, filterStore.searchQuery, filterStore.selectedCategories, filterStore.selectedFormats]);

  const stats = useMemo(
    () => ({
      total: models.length,
      categories: new Set(models.map((m) => m.category)).size,
      formats: new Set(models.map((m) => m.format)).size,
    }),
    [models],
  );

  const activeCategory =
    filterStore.selectedCategories.length === 1
      ? filterStore.selectedCategories[0]
      : null;

  const countSummary = (() => {
    if (isLoading) return null;
    if (
      activeCategory &&
      filteredModels.length === 0 &&
      models.length > 0
    ) {
      return `No models in ${categoryLabel(activeCategory)} yet.`;
    }
    return `Showing ${filteredModels.length} of ${models.length} models`;
  })();

  const clearCategory = () => {
    useFilterStore.setState({ selectedCategories: [] });
  };

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <Hero stats={stats} isLoading={isLoading} />
      <RecentlyViewed />
      <LatestUploads models={models} isLoading={isLoading} />

      <div
        id="gallery"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink">Model Gallery</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Browse and view 3D models in your browser
          </p>
        </div>

        <CategoryNav models={models} />

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <SearchBar />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SortControls />
            <FilterTag />
          </div>
        </div>

        <div className="mb-6 rounded-panel border border-line bg-surface p-4">
          <FilterPanel />
        </div>

        {countSummary && (
          <p className="mb-4 text-sm text-ink-muted" data-testid="gallery-count">
            {countSummary}
          </p>
        )}
        <ModelGallery
          models={filteredModels}
          isLoading={isLoading}
          emptyTitle={
            activeCategory
              ? `Nothing in ${categoryLabel(activeCategory)} yet`
              : undefined
          }
          emptyDescription={
            activeCategory
              ? 'No models have been added to this category. Pick another category, or clear the filter to browse everything.'
              : undefined
          }
          emptyAction={
            activeCategory ? (
              <button
                type="button"
                onClick={clearCategory}
                className="text-sm font-medium text-accent-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Browse all categories
              </button>
            ) : undefined
          }
        />
      </div>

      <MostFavorited models={models} />
    </div>
  );
}
