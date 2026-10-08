// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from './index';
import { prisma } from './prisma';

let server: Server;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}/api`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/models', () => {
  it('includes favorite counts via _count', async () => {
    const res = await fetch(`${base}/models`);
    expect(res.status).toBe(200);
    const models = (await res.json()) as Array<{
      id: string;
      _count?: { favorites: number };
    }>;
    expect(models.length).toBeGreaterThan(0);

    const raw = await prisma.model.findMany({
      include: { _count: { select: { favorites: true } } },
    });
    const expected = new Map(raw.map((m) => [m.id, m._count.favorites]));

    for (const model of models) {
      expect(model._count).toBeDefined();
      expect(model._count!.favorites).toBe(expected.get(model.id) ?? 0);
    }
  });
});
