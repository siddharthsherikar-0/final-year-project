import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma';
import { authRouter, authMiddleware, type AuthRequest } from './auth';
import { uploadRouter } from './upload';
import { favoriteRouter } from './favorites';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/favorites', favoriteRouter);

app.get('/api/models', async (_req, res) => {
  try {
    const models = await prisma.model.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { favorites: true } } },
    });
    res.json(models);
  } catch {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/api/models/mine', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const models = await prisma.model.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(models);
  } catch {
    res.status(500).json({ error: 'Failed to fetch your models' });
  }
});

app.get('/api/models/:id', async (req, res) => {
  try {
    const model = await prisma.model.findUnique({
      where: { id: req.params.id },
    });
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json(model);
  } catch {
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

if (process.env.VITEST !== 'true') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };
