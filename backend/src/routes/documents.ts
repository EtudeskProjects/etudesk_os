/**
 * Document Management Routes
 * API endpoints for talent document upload, listing, and management
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
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
    files: 1,
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

    return res.json(result);
  } catch (error) {
    console.error('Error listing documents:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des documents',
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
      ...stats,
      canUpload: uploadCheck.canUpload,
      currentCount: uploadCheck.currentCount,
      maxCount: uploadCheck.maxCount,
      maxFileSizeMB: DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
    });
  } catch (error) {
    console.error('Error getting document stats:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques',
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
      return res.status(404).json({ error: 'Profil talent non trouvé' });
    }

    const document = await getDocument(req.params.id, talentId);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    return res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération du document',
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
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const talentId = req.talentId;
      if (!talentId) {
        return res.status(404).json({ error: 'Profil talent non trouvé' });
      }

      // Check if file was provided
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      // Validate file
      const validation = validateFile({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
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

      // Get optional metadata from body
      const { document_type, title, description, is_public } = req.body;

      // Validate document type if provided
      if (document_type && !isValidDocumentType(document_type)) {
        return res.status(400).json({ error: 'Type de document invalide' });
      }

      // Upload document
      const document = await uploadDocument({
        talentId,
        file: {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        documentType: document_type,
        title,
        description,
        isPublic: is_public === 'true' || is_public === true,
      });

      return res.status(201).json({
        message: 'Document uploadé avec succès. Le traitement est en cours.',
        document,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return res.status(500).json({
        error: "Erreur lors de l'upload du document",
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
      return res.status(404).json({ error: 'Profil talent non trouvé' });
    }

    const { document_type, title, description, is_public, tags } = req.body;

    // Validate document type if provided
    if (document_type && !isValidDocumentType(document_type)) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    const document = await updateDocument(req.params.id, talentId, {
      documentType: document_type,
      title,
      description,
      isPublic: is_public,
      tags,
    });

    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    return res.json({
      message: 'Document mis à jour',
      document,
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour du document',
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
      return res.status(404).json({ error: 'Profil talent non trouvé' });
    }

    const deleted = await deleteDocument(req.params.id, talentId);
    if (!deleted) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    return res.json({ message: 'Document supprimé' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({
      error: 'Erreur lors de la suppression du document',
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
      return res.status(404).json({ error: 'Profil talent non trouvé' });
    }

    const success = await retryExtraction(req.params.id, talentId);
    if (!success) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    return res.json({
      message: "Nouvelle tentative d'extraction lancée",
    });
  } catch (error) {
    console.error('Error retrying extraction:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Erreur lors de la tentative d'extraction",
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
        error: "Un seul fichier peut être uploadé à la fois",
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
