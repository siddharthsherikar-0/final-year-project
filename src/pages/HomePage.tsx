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
import { RecentlyViewed } from '@/components/discovery/RecentlyViewed';
import { MostFavorited } from '@/components/discovery/MostFavorited';
import { CategoryNav } from '@/components/discovery/CategoryNav';
import { SectionHeader } from '@/components/studio/PageHeader';
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

  // The hero anchors on real assets rather than abstract decoration.
  const featured = useMemo(() => {
    const withPreview = models.filter((model) => Boolean(model.thumbnailUrl));
    const pool = withPreview.length > 0 ? withPreview : models;
    return [...pool]
      .sort((a, b) => {
        const favourites = (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0);
        if (favourites !== 0) return favourites;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 4);
  }, [models]);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <Hero stats={stats} isLoading={isLoading} featured={featured} />

      <RecentlyViewed />

      {/*
        Discovery is the centrepiece: statement, then category navigation, then
        search/format refinement, then the models themselves.
      */}
      <section
        id="gallery"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-8"
        aria-label="Model gallery"
      >
        <SectionHeader
          title="Discover 3D assets"
          description="Every asset below is rendered from its own file. Pick a category, refine by format, then open one in the studio."
        />

        <CategoryNav models={models} />

        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchBar />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterPanel />
            <div className="flex items-center gap-3">
              <SortControls />
              <FilterTag />
            </div>
          </div>
        </div>

        {countSummary && (
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint" data-testid="gallery-count">
            {countSummary}
          </p>
        )}

        <div className="mt-6">
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
                  className="text-sm font-medium text-ink-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-ring"
                >
                  Browse all categories
                </button>
              ) : undefined
            }
          />
        </div>
      </section>

      <MostFavorited models={models} />
    </div>
  );
}