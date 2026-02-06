import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

import { logger } from '../utils';
const router = Router();

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const ATTACHMENTS_DIR = 'attachments';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const mimeToExtension: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Types acceptés: PDF, DOC, DOCX'));
    }
  },
});

function sanitizeCategory(category: string): string {
  const cleaned = category.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : 'general';
}

function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: req.t('common:noFileProvided') });
    }

    const category = sanitizeCategory(req.body.category || 'general');
    const attachmentRoot = path.join(UPLOAD_BASE_DIR, ATTACHMENTS_DIR);
    const categoryDir = path.join(attachmentRoot, category);
    ensureDirExists(categoryDir);

    const originalExt = path.extname(req.file.originalname || '').replace('.', '').toLowerCase();
    const extension = originalExt || mimeToExtension[req.file.mimetype] || 'bin';
    const fileId = uuidv4();
    const filename = `${fileId}.${extension}`;
    const relativePath = `${ATTACHMENTS_DIR}/${category}/${filename}`;
    const absolutePath = path.join(UPLOAD_BASE_DIR, relativePath);

    await fs.promises.writeFile(absolutePath, req.file.buffer);

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `/uploads/${relativePath}`;
    const publicUrl = `${baseUrl}${url}`;

    res.status(201).json({
      data: {
        file_id: fileId,
        url,
        public_url: publicUrl,
        size: req.file.size,
        content_type: req.file.mimetype,
        original_name: req.file.originalname,
      },
    });
  } catch (error: any) {
    logger.error('[Files] Upload error:', error);
    res.status(500).json({ error: error.message || req.t('common:uploadFailed') });
  }
});

export default router;
