import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiModelRepository } from '@/data/apiModelRepository';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiModelRepository', () => {
  let repo: ApiModelRepository;

  beforeEach(() => {
    repo = new ApiModelRepository();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches all models', async () => {
    const mockData = [
      {
        id: '1',
        name: 'Test Model',
        description: 'A test',
        category: 'other',
        format: 'glb',
        fileUrl: '/models/test.glb',
        thumbnailUrl: '/models/test.png',
        fileSize: 1024,
        vertexCount: 100,
        triangleCount: 50,
        hasTextures: false,
        hasAnimations: false,
        tags: '["test"]',
        author: null,
        license: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const models = await repo.getAll();
    expect(models).toHaveLength(1);
    expect(models[0]!.name).toBe('Test Model');
    expect(models[0]!.tags).toEqual(['test']);
  });

  it('returns null for 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const model = await repo.getById('nonexistent');
    expect(model).toBeNull();
  });

  it('throws on server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(repo.getAll()).rejects.toThrow('Failed to fetch models');
  });

  it('filters by search query', async () => {
    const mockData = [
      {
        id: '1',
        name: 'Duck',
        description: 'A duck',
        category: 'characters',
        format: 'glb',
        fileUrl: '/models/duck.glb',
        thumbnailUrl: '/models/duck.png',
        fileSize: 1024,
        vertexCount: null,
        triangleCount: null,
        hasTextures: true,
        hasAnimations: false,
        tags: '["bird"]',
        author: null,
        license: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Box',
        description: 'A box',
        category: 'other',
        format: 'glb',
        fileUrl: '/models/box.glb',
        thumbnailUrl: '/models/box.png',
        fileSize: 512,
        vertexCount: null,
        triangleCount: null,
        hasTextures: false,
        hasAnimations: false,
        tags: '["geometry"]',
        author: null,
        license: null,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const results = await repo.filter({ searchQuery: 'duck' });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Duck');
  });

  it('filters by category', async () => {
    const mockData = [
      {
        id: '1',
        name: 'Duck',
        description: 'A duck',
        category: 'characters',
        format: 'glb',
        fileUrl: '/models/duck.glb',
        thumbnailUrl: '/models/duck.png',
        fileSize: 1024,
        vertexCount: null,
        triangleCount: null,
        hasTextures: true,
        hasAnimations: false,
        tags: '["bird"]',
        author: null,
        license: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Box',
        description: 'A box',
        category: 'other',
        format: 'glb',
        fileUrl: '/models/box.glb',
        thumbnailUrl: '/models/box.png',
        fileSize: 512,
        vertexCount: null,
        triangleCount: null,
        hasTextures: false,
        hasAnimations: false,
        tags: '["geometry"]',
        author: null,
        license: null,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const results = await repo.filter({ categories: ['characters'] });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Duck');
  });
});

describe('ApiModelRepository.getMine', () => {
  const fetchMock = vi.fn();

  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const record = {
    id: 'm1',
    name: 'Dragon',
    description: 'A dragon',
    category: 'characters',
    format: 'glb',
    fileUrl: '/uploads/m1.glb',
    thumbnailUrl: '/uploads/m1.glb',
    fileSize: 2048,
    vertexCount: null,
    triangleCount: 120,
    hasTextures: true,
    hasAnimations: false,
    tags: '["dragon","fantasy"]',
    author: null,
    license: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects without a token', async () => {
    const repo = new ApiModelRepository();
    await expect(repo.getMine(null)).rejects.toThrow('Not authenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches only the authenticated user models with the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse([record]));
    const repo = new ApiModelRepository();

    const models = await repo.getMine('jwt-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/models/mine');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer jwt-token',
    });
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: 'm1',
      name: 'Dragon',
      category: 'characters',
      format: 'glb',
      tags: ['dragon', 'fantasy'],
      vertexCount: undefined,
      triangleCount: 120,
    });
  });

  it('maps an expired session to a friendly error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));
    const repo = new ApiModelRepository();
    await expect(repo.getMine('expired')).rejects.toThrow(
      'Session expired. Please log in again.',
    );
  });

  it('maps other failures to a fetch error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));
    const repo = new ApiModelRepository();
    await expect(repo.getMine('token')).rejects.toThrow(
      'Failed to fetch your models',
    );
  });
});
