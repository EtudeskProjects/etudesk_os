/**
 * Organization Document Routes
 * API endpoints for organization document upload, listing, and management
 * Base: /api/v1/organizations/:orgId/documents
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';
import { logger } from '../utils';
import {
  uploadOrgDocument,
  getOrgDocument,
  listOrgDocuments,
  updateOrgDocument,
  deleteOrgDocument,
  retryOrgExtraction,
  getOrgDocumentStats,
  canOrgUploadDocument,
  validateFile,
} from '../services/org-documents/org-document.service';
import {
  ORG_DOCUMENT_TYPES,
  ORG_DOCUMENT_LIMITS,
  ALLOWED_MIME_TYPES,
  isValidOrgDocumentType,
  OrgDocumentType,
  OrgDocumentCategory,
} from '../constants/org-documents';
import { DocumentStatus } from '../constants/documents';
import crypto from 'crypto';
import { debitWalletForAction } from '../services/billing/credit.service';

const router = Router({ mergeParams: true });

// --- Multer Configuration ---

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: ORG_DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES,
    files: ORG_DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`));
    }
  },
});

// --- Helper: check org membership ---

async function checkOrgMembership(orgId: string, talentId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
    [orgId, talentId]
  );
  return result.rows[0]?.role || null;
}

// --- Routes ---

/**
 * GET /api/v1/organizations/:orgId/documents
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { type, category, status, is_public, search, limit, offset } = req.query;

    const result = await listOrgDocuments({
      organizationId: orgId,
      type: type as OrgDocumentType | undefined,
      category: category as OrgDocumentCategory | undefined,
      status: status as DocumentStatus | undefined,
      isPublic: is_public === 'true' ? true : is_public === 'false' ? false : undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.json({ data: result });
  } catch (error) {
    logger.error('Error listing org documents:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

/**
 * GET /api/v1/organizations/:orgId/documents/stats
 */
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const stats = await getOrgDocumentStats(orgId);
    const uploadCheck = await canOrgUploadDocument(orgId);

    return res.json({
      data: {
        ...stats,
        canUpload: uploadCheck.canUpload,
        currentCount: uploadCheck.currentCount,
        maxCount: uploadCheck.maxCount,
        maxFileSizeMB: ORG_DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
      },
    });
  } catch (error) {
    logger.error('Error getting org document stats:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * GET /api/v1/organizations/:orgId/documents/types
 */
router.get('/types', (_req: Request, res: Response) => {
  const types = Object.entries(ORG_DOCUMENT_TYPES).map(([key, value]) => ({
    value,
    label: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  }));

  return res.json({
    types,
    maxDocuments: ORG_DOCUMENT_LIMITS.MAX_DOCUMENTS_PER_ORG,
    maxFileSizeMB: ORG_DOCUMENT_LIMITS.MAX_FILE_SIZE_MB,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

/**
 * GET /api/v1/organizations/:orgId/documents/:id
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, id } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const document = await getOrgDocument(id, orgId);
    if (!document) return res.status(404).json({ error: 'Document non trouvé' });

    return res.json({ data: document });
  } catch (error) {
    logger.error('Error getting org document:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération du document' });
  }
});

/**
 * POST /api/v1/organizations/:orgId/documents
 */
router.post(
  '/',
  authMiddleware,
  upload.array('file', ORG_DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

      const role = await checkOrgMembership(orgId, req.talentId);
      if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      if (files.length > ORG_DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST) {
        return res.status(400).json({
          error: `Maximum ${ORG_DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`,
        });
      }

      const limitCheck = await canOrgUploadDocument(orgId);
      if (!limitCheck.canUpload) {
        return res.status(400).json({ error: limitCheck.error });
      }

      if (limitCheck.currentCount + files.length > limitCheck.maxCount) {
        return res.status(400).json({
          error: `Vous ne pouvez ajouter que ${limitCheck.maxCount - limitCheck.currentCount} document(s) supplémentaire(s). Limite: ${limitCheck.maxCount}.`,
        });
      }

      const { document_type, title, description, is_public } = req.body;

      if (document_type && !isValidOrgDocumentType(document_type)) {
        return res.status(400).json({ error: 'Type de document invalide' });
      }

      const uploadedDocuments = [];

      const idempotencyHeader = req.headers['x-idempotency-key'];
      const idempotencyPrefix = Array.isArray(idempotencyHeader)
        ? idempotencyHeader[0]
        : idempotencyHeader;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const validation = validateFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        if (!validation.valid) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
        }

        const debitKey = idempotencyPrefix
          ? `org_documents_upload_${idempotencyPrefix}_${index}`
          : `org_documents_upload_${crypto.randomUUID()}`;

        try {
          await debitWalletForAction({
            scope: 'ORGANIZATION',
            ownerId: orgId,
            actionCode: 'ORG_DOCUMENT_UPLOAD',
            idempotencyKey: debitKey,
            metadata: {
              channel: 'org_documents',
              fileName: file.originalname,
            },
            createdBy: req.talentId,
          });
        } catch (debitError: any) {
          if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
            return res.status(402).json({
              error: 'Solde crédits organisation insuffisant. Rechargez le wallet pour continuer.',
              code: 'INSUFFICIENT_CREDITS',
            });
          }
          throw debitError;
        }

        const document = await uploadOrgDocument({
          organizationId: orgId,
          uploadedBy: req.talentId,
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
      logger.error('Error uploading org document:', error);
      return res.status(500).json({
        error: 'Erreur lors de l\'upload du document',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PATCH /api/v1/organizations/:orgId/documents/:id
 */
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, id } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { document_type, title, description, is_public, tags } = req.body;

    if (document_type && !isValidOrgDocumentType(document_type)) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    const document = await updateOrgDocument(id, orgId, {
      documentType: document_type,
      title,
      description,
      isPublic: is_public,
      tags,
    });

    if (!document) return res.status(404).json({ error: 'Document non trouvé' });

    return res.json({ message: 'Document mis à jour', document });
  } catch (error) {
    logger.error('Error updating org document:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du document' });
  }
});

/**
 * DELETE /api/v1/organizations/:orgId/documents/:id
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, id } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const deleted = await deleteOrgDocument(id, orgId);
    if (!deleted) return res.status(404).json({ error: 'Document non trouvé' });

    return res.json({ message: 'Document supprimé' });
  } catch (error) {
    logger.error('Error deleting org document:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression du document' });
  }
});

/**
 * POST /api/v1/organizations/:orgId/documents/:id/retry
 */
router.post('/:id/retry', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, id } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const success = await retryOrgExtraction(id, orgId);
    if (!success) return res.status(404).json({ error: 'Document non trouvé' });

    return res.json({ message: 'Extraction relancée' });
  } catch (error) {
    logger.error('Error retrying org extraction:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur lors de la relance',
    });
  }
});

// --- Multer Error Handling ---

router.use((error: Error, _req: Request, res: Response, next: Function) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `Fichier trop volumineux. Maximum: ${ORG_DOCUMENT_LIMITS.MAX_FILE_SIZE_MB}MB`,
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: `Maximum ${ORG_DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`,
      });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) return res.status(400).json({ error: error.message });
  next();
});

export default router;
