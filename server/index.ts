import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma';
import { authRouter } from './auth';
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
    });
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models' });
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
