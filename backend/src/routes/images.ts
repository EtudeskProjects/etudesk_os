import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

import { logger } from '../utils';
const router = Router();

// Ensure upload directories exist
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const UPLOAD_DIRS = ['avatars', 'logos', 'illustrations', 'documents', 'identity'];

UPLOAD_DIRS.forEach(dir => {
  const dirPath = path.join(UPLOAD_BASE_DIR, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Multer configuration for memory storage (we'll process before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
    }
  },
});

// Image type configurations (server-side validation and further optimization if needed)
interface ImageConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  directory: string;
}

const IMAGE_CONFIGS: Record<string, ImageConfig> = {
  avatar: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 85,
    format: 'jpeg',
    directory: 'avatars',
  },
  logo: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 90,
    format: 'png',
    directory: 'logos',
  },
  illustration: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 85,
    format: 'jpeg',
    directory: 'illustrations',
  },
  document: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 90,
    format: 'jpeg',
    directory: 'documents',
  },
  identity: {
    maxWidth: 1500,
    maxHeight: 1500,
    quality: 95,
    format: 'jpeg',
    directory: 'identity',
  },
};

/**
 * Process and optimize an image using sharp
 */
async function processImage(
  buffer: Buffer,
  config: ImageConfig
): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
  let processor = sharp(buffer)
    .resize(config.maxWidth, config.maxHeight, {
      fit: 'inside', // Maintain aspect ratio
      withoutEnlargement: true, // Don't upscale smaller images
    });

  // Apply format-specific compression
  switch (config.format) {
    case 'jpeg':
      processor = processor.jpeg({
        quality: config.quality,
        progressive: true,
        mozjpeg: true, // Better compression
      });
      break;
    case 'png':
      processor = processor.png({
        quality: config.quality,
        compressionLevel: 9,
        palette: true, // Use palette for better compression when possible
      });
      break;
    case 'webp':
      processor = processor.webp({
        quality: config.quality,
        effort: 6, // Higher effort for better compression
      });
      break;
  }

  const { data, info } = await processor.toBuffer({ resolveWithObject: true });
  return { buffer: data, info };
}

/**
 * POST /api/images/upload - Upload and optimize an image
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: req.t('common:noFileProvided') });
    }

    const imageType = (req.body.image_type || 'document') as string;
    const category = req.body.category || 'general';
    const userId = req.userId;

    // Get configuration for image type
    const config = IMAGE_CONFIGS[imageType];
    if (!config) {
      return res.status(400).json({ error: req.t('common:invalidImageType') });
    }

    // Process and optimize the image
    const { buffer, info } = await processImage(req.file.buffer, config);

    // Generate unique filename
    const fileId = uuidv4();
    const extension = config.format === 'png' ? 'png' : 'jpg';
    const filename = `${fileId}.${extension}`;
    const relativePath = `${config.directory}/${filename}`;
    const absolutePath = path.resolve(UPLOAD_BASE_DIR, relativePath);

    // Path traversal protection
    const resolvedBase = path.resolve(UPLOAD_BASE_DIR);
    if (!absolutePath.startsWith(resolvedBase + path.sep)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Save the optimized image
    await fs.promises.writeFile(absolutePath, buffer);

    // Calculate compression ratio
    const originalSize = req.file.size;
    const optimizedSize = info.size;
    const compressionRatio = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

    logger.info(`[Images] Uploaded ${imageType}: ${info.width}x${info.height}, ${(optimizedSize / 1024).toFixed(1)}KB (${compressionRatio}% smaller)`);

    // Generate URLs
    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `/uploads/${relativePath}`;
    const publicUrl = `${baseUrl}${url}`;

    res.status(201).json({
      data: {
        file_id: fileId,
        url,
        public_url: publicUrl,
        width: info.width,
        height: info.height,
        size: optimizedSize,
        format: info.format,
        compression_ratio: `${compressionRatio}%`,
      },
    });
  } catch (error: any) {
    logger.error('[Images] Upload error:', error);
    res.status(500).json({ error: error.message || req.t('common:uploadFailed') });
  }
});

/**
 * POST /api/images/upload-multiple - Upload multiple images
 */
router.post('/upload-multiple', authMiddleware, upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: req.t('common:noFileProvided') });
    }

    const imageType = (req.body.image_type || 'document') as string;
    const config = IMAGE_CONFIGS[imageType];
    if (!config) {
      return res.status(400).json({ error: req.t('common:invalidImageType') });
    }

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
    const results = [];

    for (const file of files) {
      const { buffer, info } = await processImage(file.buffer, config);

      const fileId = uuidv4();
      const extension = config.format === 'png' ? 'png' : 'jpg';
      const filename = `${fileId}.${extension}`;
      const relativePath = `${config.directory}/${filename}`;
      const absolutePath = path.resolve(UPLOAD_BASE_DIR, relativePath);

      // Path traversal protection
      const resolvedBase = path.resolve(UPLOAD_BASE_DIR);
      if (!absolutePath.startsWith(resolvedBase + path.sep)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      await fs.promises.writeFile(absolutePath, buffer);

      const url = `/uploads/${relativePath}`;
      results.push({
        file_id: fileId,
        url,
        public_url: `${baseUrl}${url}`,
        width: info.width,
        height: info.height,
        size: info.size,
        original_name: file.originalname,
      });
    }

    logger.info(`[Images] Uploaded ${results.length} ${imageType} images`);

    res.status(201).json({ data: results });
  } catch (error: any) {
    logger.error('[Images] Multiple upload error:', error);
    res.status(500).json({ error: error.message || req.t('common:uploadFailed') });
  }
});

/**
 * DELETE /api/images/:fileId - Delete an image
 */
router.delete('/:fileId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    // Search for file in all directories
    for (const dir of UPLOAD_DIRS) {
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];
      for (const ext of extensions) {
        const filePath = path.join(UPLOAD_BASE_DIR, dir, `${fileId}.${ext}`);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info(`[Images] Deleted: ${dir}/${fileId}.${ext}`);
          return res.json({ success: true, message: req.t('common:imageDeleted') });
        }
      }
    }

    return res.status(404).json({ error: req.t('common:imageNotFound') });
  } catch (error: any) {
    logger.error('[Images] Delete error:', error);
    res.status(500).json({ error: req.t('common:serverError') });
  }
});

/**
 * GET /api/images/config - Get image configuration
 */
router.get('/config', (req, res) => {
  const configs = Object.entries(IMAGE_CONFIGS).map(([type, config]) => ({
    type,
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    format: config.format,
  }));

  res.json({ data: configs });
});

export default router;
