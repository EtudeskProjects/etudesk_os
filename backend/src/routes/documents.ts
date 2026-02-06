/**
 * Document Management Routes
 * API endpoints for talent document upload, listing, and management
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';
import { logger } from '../utils';
import {
  uploadDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  retryExtraction,
  getDocumentStats,
  canUploadDocument,
  validateFile,
} from '../services/documents/document.service';
import {
  DOCUMENT_TYPES,
  DOCUMENT_LIMITS,
  ALLOWED_MIME_TYPES,
  isValidDocumentType,
  DocumentType,
  DocumentCategory,
  DocumentStatus,
} from '../constants/documents';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// MULTER CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES,
    files: DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`));
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/documents
 * List all documents for the authenticated talent
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.json({ data: [], total: 0 });
    }

    const { type, category, status, is_public, search, limit, offset } = req.query;

    const result = await listDocuments({
      talentId,
      type: type as DocumentType | undefined,
      category: category as DocumentCategory | undefined,
      status: status as DocumentStatus | undefined,
      isPublic: is_public === 'true' ? true : is_public === 'false' ? false : undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.json({ data: result });
  } catch (error) {
    logger.error('Error listing documents:', error);
    return res.status(500).json({
      error: req.t('documents:fetchError'),
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/documents/stats
 * Get document statistics for the authenticated talent
 */
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.json({ total: 0, byType: {}, byStatus: {}, canUpload: true, currentCount: 0, maxCount: DOCUMENT_LIMITS.MAX_DOCUMENTS_PER_TALENT, maxFileSizeMB: DOCUMENT_LIMITS.MAX_FILE_SIZE_MB });
    }

    const stats = await getDocumentStats(talentId);
    const uploadCheck = await canUploadDocument(talentId);

    return res.json({
      data: {
        ...stats,
        canUpload: uploadCheck.canUpload,
        currentCount: uploadCheck.currentCount,
        maxCount: uploadCheck.maxCount,
        maxFileSizeMB: DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
      },
    });
  } catch (error) {
    logger.error('Error getting document stats:', error);
    return res.status(500).json({
      error: req.t('documents:fetchStatsError'),
    });
  }
});

/**
 * GET /api/documents/types
 * Get available document types
 */
router.get('/types', (req: Request, res: Response) => {
  const types = Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
    value,
    label: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  }));

  return res.json({
    types,
    maxDocuments: DOCUMENT_LIMITS.MAX_DOCUMENTS_PER_TALENT,
    maxFileSizeMB: DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

/**
 * GET /api/documents/:id
 * Get a specific document
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const document = await getDocument(req.params.id, talentId);
    if (!document) {
      return res.status(404).json({ error: req.t('documents:notFound') });
    }

    return res.json({ data: document });
  } catch (error) {
    logger.error('Error getting document:', error);
    return res.status(500).json({
      error: req.t('documents:fetchSingleError'),
    });
  }
});

/**
 * POST /api/documents
 * Upload a new document
 */
router.post(
  '/',
  authMiddleware,
  upload.array('file', DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST),
  async (req: AuthRequest, res: Response) => {
    try {
      const talentId = req.talentId;
      if (!talentId) {
        return res.status(404).json({ error: req.t('talents:profileNotFound') });
      }

      // KYC gate: require verified identity before uploading documents
      const identityCheck = await pool.query(
        `SELECT id FROM kyc_verifications
         WHERE talent_id = $1 AND status = 'VERIFIED'
         LIMIT 1`,
        [talentId]
      );

      if (identityCheck.rows.length === 0) {
        return res.status(403).json({
          error: req.t('documents:identityNotVerified'),
          code: 'IDENTITY_REQUIRED',
          message: req.t('documents:identityRequiredMessage'),
        });
      }

      const files = req.files as Express.Multer.File[] | undefined;

      // Support both single file (req.file) and multi-file (req.files)
      if (!files || files.length === 0) {
        return res.status(400).json({ error: req.t('common:noFileProvided') });
      }

      if (files.length > DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST) {
        return res.status(400).json({
          error: `Maximum ${DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`,
        });
      }

      // Check document limit
      const limitCheck = await canUploadDocument(talentId);
      if (!limitCheck.canUpload) {
        return res.status(400).json({
          error: limitCheck.error,
          currentCount: limitCheck.currentCount,
          maxCount: limitCheck.maxCount,
        });
      }

      // Check if adding these files would exceed the limit
      if (limitCheck.currentCount + files.length > limitCheck.maxCount) {
        return res.status(400).json({
          error: `Vous ne pouvez ajouter que ${limitCheck.maxCount - limitCheck.currentCount} document(s) supplémentaire(s). Limite: ${limitCheck.maxCount}.`,
          currentCount: limitCheck.currentCount,
          maxCount: limitCheck.maxCount,
        });
      }

      // Get optional metadata from body
      const { document_type, title, description, is_public } = req.body;

      // Validate document type if provided
      if (document_type && !isValidDocumentType(document_type)) {
        return res.status(400).json({ error: req.t('documents:invalidDocumentType') });
      }

      const uploadedDocuments = [];

      for (const file of files) {
        // Validate each file
        const validation = validateFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        if (!validation.valid) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
        }

        // Upload document
        const document = await uploadDocument({
          talentId,
          file: {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
          documentType: document_type,
          title: files.length === 1 ? title : undefined,
          description: files.length === 1 ? description : undefined,
          isPublic: is_public === 'true' || is_public === true,
        });

        uploadedDocuments.push(document);
      }

      const message = uploadedDocuments.length === 1
        ? 'Document uploadé avec succès. Le traitement est en cours.'
        : `${uploadedDocuments.length} documents uploadés avec succès. Le traitement est en cours.`;

      return res.status(201).json({
        message,
        document: uploadedDocuments.length === 1 ? uploadedDocuments[0] : undefined,
        documents: uploadedDocuments,
      });
    } catch (error) {
      logger.error('Error uploading document:', error);
      return res.status(500).json({
        error: req.t('documents:uploadError'),
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PATCH /api/documents/:id
 * Update document metadata
 */
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const { document_type, title, description, is_public, tags } = req.body;

    // Validate document type if provided
    if (document_type && !isValidDocumentType(document_type)) {
      return res.status(400).json({ error: req.t('documents:invalidDocumentType') });
    }

    const document = await updateDocument(req.params.id, talentId, {
      documentType: document_type,
      title,
      description,
      isPublic: is_public,
      tags,
    });

    if (!document) {
      return res.status(404).json({ error: req.t('documents:notFound') });
    }

    return res.json({
      message: req.t('documents:updateSuccess'),
      document,
    });
  } catch (error) {
    logger.error('Error updating document:', error);
    return res.status(500).json({
      error: req.t('documents:updateError'),
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const deleted = await deleteDocument(req.params.id, talentId);
    if (!deleted) {
      return res.status(404).json({ error: req.t('documents:notFound') });
    }

    return res.json({ message: req.t('documents:deleteSuccess') });
  } catch (error) {
    logger.error('Error deleting document:', error);
    return res.status(500).json({
      error: req.t('documents:deleteError'),
    });
  }
});

/**
 * POST /api/documents/:id/retry
 * Retry document extraction for failed documents
 */
router.post('/:id/retry', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const success = await retryExtraction(req.params.id, talentId);
    if (!success) {
      return res.status(404).json({ error: req.t('documents:notFound') });
    }

    return res.json({
      message: req.t('documents:retrySuccess'),
    });
  } catch (error) {
    logger.error('Error retrying extraction:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : req.t('documents:retryError'),
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING FOR MULTER
// ═══════════════════════════════════════════════════════════════

router.use((error: Error, req: Request, res: Response, next: Function) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `Fichier trop volumineux. Maximum: ${DOCUMENT_LIMITS.MAX_FILE_SIZE_MB}MB`,
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: `Maximum ${DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`,
      });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

export default router;
