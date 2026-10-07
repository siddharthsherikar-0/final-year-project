import type { ModelMetadata, ModelFilter } from '@/types';
import { modelRegistry } from './modelRegistry';
import { ApiModelRepository } from './apiModelRepository';

export interface ModelRepository {
  getAll(): Promise<ModelMetadata[]>;
  getById(id: string): Promise<ModelMetadata | null>;
  filter(filter: ModelFilter): Promise<ModelMetadata[]>;
}

class StaticModelRepository implements ModelRepository {
  async getAll(): Promise<ModelMetadata[]> {
    return [...modelRegistry];
  }

  async getById(id: string): Promise<ModelMetadata | null> {
    return modelRegistry.find((m) => m.id === id) ?? null;
  }

  async filter(filter: ModelFilter): Promise<ModelMetadata[]> {
    let results = [...modelRegistry];

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      results = results.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    if (filter.categories && filter.categories.length > 0) {
      results = results.filter((m) => filter.categories!.includes(m.category));
    }

    if (filter.formats && filter.formats.length > 0) {
      results = results.filter((m) => filter.formats!.includes(m.format));
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((m) =>
        filter.tags!.some((t) => m.tags.includes(t)),
      );
    }

    if (filter.sortBy) {
      const key = filter.sortBy;
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const aVal = key === 'date' ? a.createdAt : key === 'size' ? a.fileSize : a.name;
        const bVal = key === 'date' ? b.createdAt : key === 'size' ? b.fileSize : b.name;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * order;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * order;
        }
        return 0;
      });
    }

    return results;
  }
}

export function createModelRepository(): ModelRepository {
  const useApi = import.meta.env.VITE_USE_API === 'true';
  return useApi ? new ApiModelRepository() : new StaticModelRepository();
}

export const modelRepository: ModelRepository = createModelRepository();
