import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiModelRepository } from '@/data/apiModelRepository';

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

describe('ApiModelRepository.getMine', () => {
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
