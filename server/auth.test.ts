import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from './prisma';
import { authRouter } from './auth';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let userA: { id: string; email: string; name: string };
let userB: { id: string; email: string; name: string };
let tokenA: string;

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2,
  });
  if (users.length < 2) {
    throw new Error('Expected at least 2 existing users in the dev database');
  }
  userA = { id: users[0].id, email: users[0].email, name: users[0].name };
  userB = { id: users[1].id, email: users[1].email, name: users[1].name };
  tokenA = jwt.sign({ userId: userA.id }, JWT_SECRET, { expiresIn: '7d' });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/auth`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('GET /api/auth/me', () => {
  it('rejects a request without a token with 401', async () => {
    const res = await fetch(`${baseUrl}/me`);
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token with 401', async () => {
    const res = await fetch(`${baseUrl}/me`, { headers: authHeader('not-a-jwt') });
    expect(res.status).toBe(401);
  });

  it('returns the verified token user with id, email, and name', async () => {
    const res = await fetch(`${baseUrl}/me`, { headers: authHeader(tokenA) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: userA.id, email: userA.email, name: userA.name });
  });

  it('ignores any client-supplied user id and only honors the JWT identity', async () => {
    const res = await fetch(
      `${baseUrl}/me?id=${userB.id}&userId=${userB.id}`,
      {
        headers: {
          ...authHeader(tokenA),
          'x-user-id': userB.id,
          'x-forwarded-user': userB.id,
        },
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(userA.id);
    expect(body.id).not.toBe(userB.id);
    expect(body.email).toBe(userA.email);
  });

  it('has no state-changing verb that could target another user', async () => {
    const res = await fetch(`${baseUrl}/me`, {
      method: 'POST',
      headers: { ...authHeader(tokenA), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userB.id }),
    });
    expect(res.status).toBe(404);
  });
});
