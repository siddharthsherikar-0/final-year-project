import { describe, it, expect } from 'vitest';
import { modelRepository } from '@/data/modelRepository';
import type { ModelFilter } from '@/types';

describe('modelRepository', () => {
  it('returns all models', async () => {
    const models = await modelRepository.getAll();
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns model by id', async () => {
    const model = await modelRepository.getById('sample-duck');
    expect(model).not.toBeNull();
    expect(model!.name).toBe('Duck');
  });

  it('returns null for unknown id', async () => {
    const model = await modelRepository.getById('nonexistent');
    expect(model).toBeNull();
  });

  it('filters by search query', async () => {
    const filter: ModelFilter = { searchQuery: 'duck' };
    const models = await modelRepository.filter(filter);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.name.toLowerCase().includes('duck'))).toBe(true);
  });

  it('filters by category', async () => {
    const filter: ModelFilter = { categories: ['characters'] };
    const models = await modelRepository.filter(filter);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.category === 'characters')).toBe(true);
  });

  it('filters by format', async () => {
    const filter: ModelFilter = { formats: ['glb'] };
    const models = await modelRepository.filter(filter);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.format === 'glb')).toBe(true);
  });

  it('sorts by name ascending', async () => {
    const filter: ModelFilter = { sortBy: 'name', sortOrder: 'asc' };
    const models = await modelRepository.filter(filter);
    for (let i = 1; i < models.length; i++) {
      expect(models[i]!.name.localeCompare(models[i - 1]!.name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by name descending', async () => {
    const filter: ModelFilter = { sortBy: 'name', sortOrder: 'desc' };
    const models = await modelRepository.filter(filter);
    for (let i = 1; i < models.length; i++) {
      expect(models[i]!.name.localeCompare(models[i - 1]!.name)).toBeLessThanOrEqual(0);
    }
  });
});
