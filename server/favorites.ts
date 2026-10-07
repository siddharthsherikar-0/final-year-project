import { Router } from 'express';
import { prisma } from './prisma';
import { authMiddleware, type AuthRequest } from './auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.userId },
      include: { model: true },
    });
    res.json(favorites.map((f) => f.model));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/:modelId', async (req: AuthRequest, res) => {
  try {
    const { modelId } = req.params;
    const model = await prisma.model.findUnique({ where: { id: modelId } });
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_modelId: { userId: req.userId!, modelId } },
    });
    if (existing) {
      res.status(409).json({ error: 'Already favorited' });
      return;
    }

    const favorite = await prisma.favorite.create({
      data: { userId: req.userId!, modelId },
    });
    res.status(201).json(favorite);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/:modelId', async (req: AuthRequest, res) => {
  try {
    const { modelId } = req.params;
    const existing = await prisma.favorite.findUnique({
      where: { userId_modelId: { userId: req.userId!, modelId } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }

    await prisma.favorite.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

router.get('/check/:modelId', async (req: AuthRequest, res) => {
  try {
    const { modelId } = req.params;
    const existing = await prisma.favorite.findUnique({
      where: { userId_modelId: { userId: req.userId!, modelId } },
    });
    res.json({ isFavorited: !!existing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

export { router as favoriteRouter };
