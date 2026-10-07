import { describe, it, expect } from 'vitest';
import { createModelRepository, modelRepository } from '@/data/modelRepository';

describe('modelRepository factory', () => {
  it('creates a repository instance', () => {
    const repo = createModelRepository();
    expect(repo).toBeDefined();
    expect(typeof repo.getAll).toBe('function');
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.filter).toBe('function');
  });

  it('exports a default repository instance', () => {
    expect(modelRepository).toBeDefined();
    expect(typeof modelRepository.getAll).toBe('function');
  });
});
