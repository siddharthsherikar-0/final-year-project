// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { app } from './index';
import { prisma } from './prisma';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

let server: Server;
let base: string;
let token: string;
const created = { id: null as string | null, file: null as string | null };

async function uploadProbe(): Promise<Response> {
  const form = new FormData();
  const bytes = new Uint8Array([
    0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00,
  ]);
  form.append(
    'model',
    new Blob([bytes], { type: 'model/gltf-binary' }),
    'availability-probe.glb',
  );
  form.append('name', 'Availability Probe');
  form.append('description', 'Verifies immediate availability after upload');
  form.append('category', 'other');
  form.append('tags', '');
  return fetch(`${base}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

beforeAll(async () => {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('Expected at least one existing user');
  token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}/api`;
});

afterAll(async () => {
  if (created.id) {
    await prisma.favorite.deleteMany({ where: { modelId: created.id } });
    await prisma.model
      .delete({ where: { id: created.id } })
      .catch(() => undefined);
  }
  if (created.file && fs.existsSync(created.file)) {
    fs.unlinkSync(created.file);
  }
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('uploaded model availability', () => {
  it('POST /api/upload returns 201 with a valid model id', async () => {
    const res = await uploadProbe();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.name).toBe('Availability Probe');
    created.id = body.id;
    created.file = body.fileUrl
      ? path.join(__dirname, '..', 'public', body.fileUrl)
      : null;
  });

  it('immediately serves the model from GET /api/models/:id', async () => {
    expect(created.id).toBeTruthy();
    const res = await fetch(`${base}/models/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Availability Probe');
  });

  it('immediately lists the model in GET /api/models/mine for the uploader', async () => {
    const res = await fetch(`${base}/models/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((m: { id: string }) => m.id === created.id)).toBe(true);
  });

  it('immediately lists the model in GET /api/models for the gallery', async () => {
    const res = await fetch(`${base}/models`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((m: { id: string }) => m.id === created.id)).toBe(true);
  });
});
