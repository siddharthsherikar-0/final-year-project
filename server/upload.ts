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

/** Guards the base64 field so a malformed client cannot exhaust memory. */
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

interface StoredThumbnail {
  fileName: string;
  extension: string;
}

function readMagicBytes(buffer: Buffer): 'jpeg' | 'png' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  return null;
}

/**
 * Persists a client-rendered studio preview.
 *
 * The browser renders the asset once (see src/utils/thumbnailRenderer.ts) and
 * posts the encoded image with the model. A missing or unusable preview is not
 * an upload failure: the model is stored with an empty thumbnailUrl and the UI
 * falls back to its placeholder.
 */
function saveThumbnail(dataUrl: string, modelFileName: string): StoredThumbnail | null {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_THUMBNAIL_BYTES) return null;

  const magic = readMagicBytes(buffer);
  if (!magic) return null;

  const extension = magic === 'jpeg' ? 'jpg' : 'png';
  const stem = modelFileName.replace(/\.[^.]+$/, '');
  const fileName = `${stem}-thumb.${extension}`;

  try {
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  } catch {
    return null;
  }

  return { fileName, extension };
}

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

      const { name, description, category, tags, thumbnail } = req.body as {
        name?: string;
        description?: string;
        category?: string;
        tags?: string;
        thumbnail?: string;
      };

      if (!name || !description || !category) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Name, description, and category are required' });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const format = ext.slice(1);

      let thumbnailUrl = '';
      if (typeof thumbnail === 'string' && thumbnail.length > 0) {
        const stored = saveThumbnail(thumbnail, req.file.filename);
        if (stored) thumbnailUrl = `/uploads/${stored.fileName}`;
      }

      const model = await prisma.model.create({
        data: {
          name,
          description,
          category,
          format,
          fileUrl: `/uploads/${req.file.filename}`,
          thumbnailUrl,
          fileSize: req.file.size,
          tags: tags ? JSON.stringify(tags.split(',').map((t) => t.trim())) : '[]',
          userId: req.userId,
        },
      });

      res.status(201).json(model);
    } catch {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

export { router as uploadRouter };
