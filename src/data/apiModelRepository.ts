import type { ModelMetadata, ModelFilter } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

interface ApiModelRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  format: string;
  fileUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  vertexCount: number | null;
  triangleCount: number | null;
  hasTextures: boolean;
  hasAnimations: boolean;
  tags: string;
  author: string | null;
  license: string | null;
  createdAt: string;
  updatedAt: string;
}

function recordToMetadata(record: ApiModelRecord): ModelMetadata {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    category: record.category as ModelMetadata['category'],
    format: record.format as ModelMetadata['format'],
    fileUrl: record.fileUrl,
    thumbnailUrl: record.thumbnailUrl,
    fileSize: record.fileSize,
    vertexCount: record.vertexCount ?? undefined,
    triangleCount: record.triangleCount ?? undefined,
    hasTextures: record.hasTextures,
    hasAnimations: record.hasAnimations,
    tags: JSON.parse(record.tags) as string[],
    author: record.author ?? undefined,
    license: record.license ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class ApiModelRepository {
  async getAll(): Promise<ModelMetadata[]> {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    const records = (await res.json()) as ApiModelRecord[];
    return records.map(recordToMetadata);
  }

  async getById(id: string): Promise<ModelMetadata | null> {
    const res = await fetch(`${API_BASE}/models/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch model');
    const record = (await res.json()) as ApiModelRecord;
    return recordToMetadata(record);
  }

  async filter(filter: ModelFilter): Promise<ModelMetadata[]> {
    const all = await this.getAll();
    let results = [...all];

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
