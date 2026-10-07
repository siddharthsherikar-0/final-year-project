import { useEffect, useMemo } from 'react';
import { useModelStore } from '@/stores/useModelStore';
import { useFilterStore } from '@/stores/useFilterStore';
import { ModelGallery } from '@/components/gallery/ModelGallery';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { FilterTag } from '@/components/search/FilterTag';
import { Spinner } from '@/components/ui/Spinner';
import { Hero } from '@/components/landing/Hero';
import { LatestUploads } from '@/components/landing/LatestUploads';

export function HomePage() {
  const { models, isLoading, error, fetchModels } = useModelStore();
  const filterStore = useFilterStore();

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

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

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchBar />
          </div>
          <FilterTag />
        </div>

        <div className="mb-6 rounded-panel border border-line bg-surface p-4">
          <FilterPanel />
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              Showing {filteredModels.length} of {models.length} models
            </p>
            <ModelGallery models={filteredModels} isLoading={false} />
          </>
        )}
      </div>
    </div>
  );
}
