import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma';
import { authMiddleware, type AuthRequest } from './auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.glb' || ext === '.gltf') {
      cb(null, true);
    } else {
      cb(new Error('Only GLB and GLTF files are allowed'));
    }
  },
});

const router = Router();

router.post(
  '/',
  authMiddleware,
  upload.single('model'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { name, description, category, tags } = req.body as {
        name?: string;
        description?: string;
        category?: string;
        tags?: string;
      };

      if (!name || !description || !category) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Name, description, and category are required' });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const format = ext.slice(1);

      const model = await prisma.model.create({
        data: {
          name,
          description,
          category,
          format,
          fileUrl: `/uploads/${req.file.filename}`,
          thumbnailUrl: `/uploads/${req.file.filename}`,
          fileSize: req.file.size,
          tags: tags ? JSON.stringify(tags.split(',').map((t) => t.trim())) : '[]',
          userId: req.userId,
        },
      });

      res.status(201).json(model);
    } catch (err) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

export { router as uploadRouter };
