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
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let server: Server;
let base: string;
let token: string;
const createdIds: string[] = [];
const createdFiles: string[] = [];

/** 1x1 JPEG, enough to pass the magic-byte check the server performs. */
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const TINY_JPEG_DATA_URL = `data:image/jpeg;base64,${TINY_JPEG_BASE64}`;

interface UploadOptions {
  thumbnail?: string;
  name?: string;
}

async function uploadModel(options: UploadOptions = {}): Promise<Response> {
  const form = new FormData();
  const bytes = new Uint8Array([
    0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00,
  ]);
  form.append(
    'model',
    new Blob([bytes], { type: 'model/gltf-binary' }),
    'thumbnail-probe.glb',
  );
  form.append('name', options.name ?? 'Thumbnail Probe');
  form.append('description', 'Exercises the studio preview upload field');
  form.append('category', 'other');
  form.append('tags', '');
  if (options.thumbnail !== undefined) {
    form.append('thumbnail', options.thumbnail);
  }
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
  for (const id of createdIds) {
    await prisma.favorite.deleteMany({ where: { modelId: id } });
    await prisma.model.delete({ where: { id } }).catch(() => undefined);
  }
  for (const file of createdFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe('uploaded studio previews', () => {
  it('persists a client-rendered preview and serves it as a static image', async () => {
    const res = await uploadModel({ thumbnail: TINY_JPEG_DATA_URL, name: 'With Preview' });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdIds.push(body.id);

    expect(body.thumbnailUrl).toMatch(/^\/uploads\/.*-thumb\.jpg$/);
    createdFiles.push(path.join(PUBLIC_DIR, body.thumbnailUrl));

    const written = fs.readFileSync(path.join(PUBLIC_DIR, body.thumbnailUrl));
    expect(written.byteLength).toBeGreaterThan(0);
    // Magic bytes: the file really is an image, not base64 text.
    expect([written[0], written[1], written[2]]).toEqual([0xff, 0xd8, 0xff]);

    const served = await fetch(`${base.replace('/api', '')}${body.thumbnailUrl}`);
    expect(served.status).toBe(200);
  });

  it('stores an empty thumbnailUrl when no preview was generated', async () => {
    const res = await uploadModel({ name: 'Without Preview' });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdIds.push(body.id);

    expect(body.thumbnailUrl).toBe('');
  });

  it('still succeeds when the preview payload is unusable', async () => {
    const res = await uploadModel({
      thumbnail: 'data:image/jpeg;base64,bm90LWFuLWltYWdl',
      name: 'Broken Preview',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdIds.push(body.id);

    // Magic-byte validation rejects it, and the model still publishes.
    expect(body.thumbnailUrl).toBe('');
  });

  it('rejects a non-data-URL payload without failing the upload', async () => {
    const res = await uploadModel({
      thumbnail: 'javascript:alert(1)',
      name: 'Hostile Preview',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdIds.push(body.id);
    expect(body.thumbnailUrl).toBe('');
  });

  it('never points thumbnailUrl at the model file itself', async () => {
    const res = await uploadModel({ name: 'No Aliasing' });
    const body = await res.json();
    createdIds.push(body.id);

    expect(body.thumbnailUrl).not.toBe(body.fileUrl);
  });
});