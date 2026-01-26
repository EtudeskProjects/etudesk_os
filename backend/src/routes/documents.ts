import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../services/database';
import { authMiddleware, requireTalentProfile, requireAdmin, AuthRequest } from '../middleware/auth.middleware';
import { queueDocumentForExtraction, processDocumentSkills } from '../services/skill-extraction.service';
import { classifyDocument, classifyDocumentFromUrl, DOCUMENT_CATEGORIES, DOCUMENT_TYPE_LABELS, DocumentType } from '../services/document-classification.service';

const router = Router();

// Document categories imported from classification service

// ============================================================================
// TALENT ENDPOINTS
// ============================================================================

/**
 * GET /api/documents - Get all documents for current talent
 */
router.get('/', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { category, type, status } = req.query;

    let query = `
      SELECT d.*,
        (SELECT json_agg(json_build_object('skill_name', ds.skill_name, 'relevance_score', ds.relevance_score))
         FROM document_skills ds WHERE ds.document_id = d.id) as extracted_skills
      FROM documents d
      WHERE d.talent_id = $1 AND d.deleted_at IS NULL
    `;
    const params: (string | null)[] = [talentId!];
    let paramIndex = 2;

    if (category) {
      query += ` AND d.category = $${paramIndex++}`;
      params.push(category as string);
    }
    if (type) {
      query += ` AND d.type = $${paramIndex++}`;
      params.push(type as string);
    }
    if (status) {
      query += ` AND d.verification_status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY d.is_primary DESC, d.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

/**
 * GET /api/documents/requirements/:feature - Get document requirements for a feature
 */
router.get('/requirements/:feature', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { feature } = req.params;

    const result = await pool.query(
      `SELECT * FROM check_document_requirements($1, $2)`,
      [talentId, feature.toUpperCase()]
    );

    const requirements = result.rows;
    const allSatisfied = requirements.every(r => r.is_satisfied || !r.must_be_verified);
    const requiredMissing = requirements.filter(r => r.must_be_verified && !r.is_satisfied);

    res.json({
      data: {
        feature,
        requirements,
        all_satisfied: allSatisfied,
        can_proceed: requiredMissing.length === 0,
        missing_required: requiredMissing
      }
    });
  } catch (error) {
    console.error('Error checking requirements:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification des exigences' });
  }
});

/**
 * GET /api/documents/identity/status - Get identity verification status
 */
router.get('/identity/status', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;

    // Get the most recent identity document
    const result = await pool.query(`
      SELECT id, type, title, verification_status, rejection_reason,
             submitted_at, verified_at, front_image_url, back_image_url
      FROM documents
      WHERE talent_id = $1 AND category = 'IDENTITY' AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [talentId]);

    if (result.rows.length === 0) {
      return res.json({
        data: {
          status: 'NONE',
          has_submission: false
        }
      });
    }

    const doc = result.rows[0];
    res.json({
      data: {
        id: doc.id,
        document_type: doc.type,
        status: doc.verification_status,
        rejection_reason: doc.rejection_reason,
        submitted_at: doc.submitted_at,
        verified_at: doc.verified_at,
        has_submission: true
      }
    });
  } catch (error) {
    console.error('Error fetching identity status:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

/**
 * POST /api/documents - Upload a new document
 * If type is not provided, auto-classification will be attempted
 */
router.post('/', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    let {
      type,
      title,
      file_url,
      front_image_url,
      back_image_url,
      issued_by,
      issued_at,
      expires_at,
      credential_id,
      verification_url,
      visibility = 'PRIVATE',
      is_primary = false,
      auto_classify = true
    } = req.body;

    const fileUrl = file_url || front_image_url;
    if (!fileUrl) {
      return res.status(400).json({ error: 'file_url ou front_image_url est requis' });
    }

    // Auto-classify if type not provided
    let classification = null;
    if (!type && auto_classify) {
      classification = await classifyDocumentFromUrl(fileUrl);
      type = classification.detected_type;
      if (!title) {
        title = classification.suggested_title;
      }
      console.log(`📄 Auto-classified document as ${type} (${Math.round(classification.confidence * 100)}% confidence)`);
    }

    if (!type) {
      return res.status(400).json({ error: 'Le type de document est requis (ou activez auto_classify)' });
    }

    const category = DOCUMENT_CATEGORIES[type as DocumentType];
    if (!category) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    // For identity documents, front_image_url is required
    if (category === 'IDENTITY' && !front_image_url) {
      // If we have file_url but not front_image_url, use file_url as front_image
      if (file_url) {
        front_image_url = file_url;
      } else {
        return res.status(400).json({ error: 'L\'image recto est requise pour les documents d\'identité' });
      }
    }

    // Check for pending identity document
    if (category === 'IDENTITY') {
      const pendingCheck = await pool.query(`
        SELECT id FROM documents
        WHERE talent_id = $1 AND category = 'IDENTITY' AND verification_status = 'PENDING' AND deleted_at IS NULL
      `, [talentId]);

      if (pendingCheck.rows.length > 0) {
        return res.status(400).json({
          error: 'Vous avez déjà une vérification d\'identité en cours. Veuillez attendre la validation.'
        });
      }
    }

    // If setting as primary, unset other primary documents of same category
    if (is_primary) {
      await pool.query(`
        UPDATE documents SET is_primary = FALSE
        WHERE talent_id = $1 AND category = $2 AND is_primary = TRUE
      `, [talentId, category]);
    }

    const documentTitle = title || getDefaultTitle(type);
    const id = uuidv4();

    // Build metadata with classification info
    const metadata = classification ? {
      auto_classified: true,
      classification_confidence: classification.confidence,
      classification_details: classification.details,
      classification_reasoning: classification.reasoning
    } : null;

    const result = await pool.query(`
      INSERT INTO documents (
        id, talent_id, type, category, title, file_url, front_image_url, back_image_url,
        issued_by, issued_at, expires_at, credential_id, verification_url,
        visibility, is_primary, verification_status, submitted_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'PENDING', NOW(), $16)
      RETURNING *
    `, [
      id, talentId, type, category, documentTitle, file_url, front_image_url, back_image_url,
      issued_by, issued_at, expires_at, credential_id, verification_url, visibility, is_primary,
      metadata ? JSON.stringify(metadata) : null
    ]);

    // Queue for skill extraction if applicable type
    const extractableTypes = ['CV', 'CERTIFICATE', 'DIPLOMA', 'PORTFOLIO', 'TRANSCRIPT', 'LICENSE'];
    if (extractableTypes.includes(type)) {
      queueDocumentForExtraction(id);
    }

    res.status(201).json({
      data: result.rows[0],
      classification: classification ? {
        detected_type: classification.detected_type,
        confidence: classification.confidence,
        suggested_title: classification.suggested_title
      } : undefined
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du document' });
  }
});

/**
 * POST /api/documents/identity - Submit identity document (simplified endpoint)
 */
router.post('/identity', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { document_type, front_image_url, back_image_url } = req.body;

    if (!document_type || !front_image_url) {
      return res.status(400).json({ error: 'Le type de document et l\'image recto sont requis' });
    }

    const validTypes = ['ID_CARD', 'PASSPORT', 'DRIVER_LICENSE'];
    if (!validTypes.includes(document_type)) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    // Check for pending submission
    const pendingCheck = await pool.query(`
      SELECT id FROM documents
      WHERE talent_id = $1 AND category = 'IDENTITY' AND verification_status = 'PENDING' AND deleted_at IS NULL
    `, [talentId]);

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Vous avez déjà une vérification en cours. Veuillez attendre la validation.'
      });
    }

    const title = getDefaultTitle(document_type);
    const id = uuidv4();

    const result = await pool.query(`
      INSERT INTO documents (
        id, talent_id, type, category, title, front_image_url, back_image_url,
        verification_status, is_primary, submitted_at
      ) VALUES ($1, $2, $3, 'IDENTITY', $4, $5, $6, 'PENDING', TRUE, NOW())
      RETURNING *
    `, [id, talentId, document_type, title, front_image_url, back_image_url]);

    // Also insert into legacy kyc_verifications for backward compatibility
    await pool.query(`
      INSERT INTO kyc_verifications (id, talent_id, document_type, front_image_url, back_image_url, status, submitted_at)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
    `, [id, talentId, document_type, front_image_url, back_image_url]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error submitting identity document:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission du document' });
  }
});

/**
 * GET /api/documents/cv - Get the talent's CV for application pre-fill
 * Returns the most recent CV document if available
 */
router.get('/cv', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;

    // Get the most recent CV document
    const result = await pool.query(`
      SELECT id, title, file_url, created_at, verification_status, is_primary
      FROM documents
      WHERE talent_id = $1 AND type = 'CV' AND deleted_at IS NULL
      ORDER BY is_primary DESC, created_at DESC
      LIMIT 1
    `, [talentId]);

    if (result.rows.length === 0) {
      return res.json({
        has_cv: false,
        data: null,
        message: 'Aucun CV trouvé dans vos documents'
      });
    }

    res.json({
      has_cv: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching CV:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du CV' });
  }
});

/**
 * GET /api/documents/cv/all - Get all CV documents for selection
 * Returns all CV documents for the talent
 */
router.get('/cv/all', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;

    const result = await pool.query(`
      SELECT id, title, file_url, created_at, verification_status, is_primary
      FROM documents
      WHERE talent_id = $1 AND type = 'CV' AND deleted_at IS NULL
      ORDER BY is_primary DESC, created_at DESC
    `, [talentId]);

    res.json({
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching CVs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des CVs' });
  }
});

/**
 * GET /api/documents/me - Get all documents for current talent (alias)
 */
router.get('/me', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { limit = 50 } = req.query;

    const result = await pool.query(`
      SELECT d.*
      FROM documents d
      WHERE d.talent_id = $1 AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT $2
    `, [talentId, Number(limit)]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching my documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

/**
 * GET /api/documents/:id - Get a specific document
 */
router.get('/:id', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT d.*,
        (SELECT json_agg(json_build_object('skill_name', ds.skill_name, 'relevance_score', ds.relevance_score))
         FROM document_skills ds WHERE ds.document_id = d.id) as extracted_skills
      FROM documents d
      WHERE d.id = $1 AND d.talent_id = $2 AND d.deleted_at IS NULL
    `, [id, talentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du document' });
  }
});

/**
 * PUT /api/documents/:id - Update a document
 */
router.put('/:id', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    const { title, visibility, is_primary, issued_by, issued_at, expires_at, credential_id, verification_url } = req.body;

    // Check ownership
    const existingResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL',
      [id, talentId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const existing = existingResult.rows[0];

    // Cannot modify verified identity documents
    if (existing.category === 'IDENTITY' && existing.verification_status === 'VERIFIED') {
      return res.status(400).json({ error: 'Les documents d\'identité vérifiés ne peuvent pas être modifiés' });
    }

    // If setting as primary, unset other primary documents of same category
    if (is_primary && !existing.is_primary) {
      await pool.query(`
        UPDATE documents SET is_primary = FALSE
        WHERE talent_id = $1 AND category = $2 AND is_primary = TRUE AND id != $3
      `, [talentId, existing.category, id]);
    }

    const result = await pool.query(`
      UPDATE documents SET
        title = COALESCE($1, title),
        visibility = COALESCE($2, visibility),
        is_primary = COALESCE($3, is_primary),
        issued_by = COALESCE($4, issued_by),
        issued_at = COALESCE($5, issued_at),
        expires_at = COALESCE($6, expires_at),
        credential_id = COALESCE($7, credential_id),
        verification_url = COALESCE($8, verification_url),
        updated_at = NOW()
      WHERE id = $9 AND talent_id = $10
      RETURNING *
    `, [title, visibility, is_primary, issued_by, issued_at, expires_at, credential_id, verification_url, id, talentId]);

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du document' });
  }
});

/**
 * DELETE /api/documents/:id - Delete a document (soft delete)
 */
router.delete('/:id', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Check ownership and status
    const existingResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL',
      [id, talentId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const existing = existingResult.rows[0];

    // Cannot delete verified identity documents
    if (existing.category === 'IDENTITY' && existing.verification_status === 'VERIFIED') {
      return res.status(400).json({ error: 'Les documents d\'identité vérifiés ne peuvent pas être supprimés' });
    }

    await pool.query(
      'UPDATE documents SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ success: true, message: 'Document supprimé' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du document' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /api/documents/admin/pending - Get all pending documents (admin only)
 */
router.get('/admin/pending', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT d.*, t.display_name as talent_name, t.email as talent_email
      FROM documents d
      JOIN talents t ON t.id = d.talent_id
      WHERE d.verification_status = 'PENDING' AND d.deleted_at IS NULL
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND d.category = $${paramIndex++}`;
      params.push(category as string);
    }

    query += ` ORDER BY d.submitted_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

/**
 * PUT /api/documents/admin/:id/verify - Verify a document (admin only)
 */
router.put('/admin/:id/verify', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.talentId;

    const result = await pool.query(`
      UPDATE documents SET
        verification_status = 'VERIFIED',
        verified_by = $1,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE id = $2 AND verification_status = 'PENDING' AND deleted_at IS NULL
      RETURNING *
    `, [adminId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé ou déjà traité' });
    }

    // Also update legacy kyc_verifications if it's an identity document
    if (result.rows[0].category === 'IDENTITY') {
      await pool.query(`
        UPDATE kyc_verifications SET status = 'VERIFIED', verified_by = $1, verified_at = NOW()
        WHERE id = $2
      `, [adminId, id]);
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du document' });
  }
});

/**
 * PUT /api/documents/admin/:id/reject - Reject a document (admin only)
 */
router.put('/admin/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const adminId = req.talentId;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'La raison du rejet est requise' });
    }

    const result = await pool.query(`
      UPDATE documents SET
        verification_status = 'REJECTED',
        rejection_reason = $1,
        verified_by = $2,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE id = $3 AND verification_status = 'PENDING' AND deleted_at IS NULL
      RETURNING *
    `, [rejection_reason, adminId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé ou déjà traité' });
    }

    // Also update legacy kyc_verifications if it's an identity document
    if (result.rows[0].category === 'IDENTITY') {
      await pool.query(`
        UPDATE kyc_verifications SET status = 'REJECTED', rejection_reason = $1, verified_by = $2, verified_at = NOW()
        WHERE id = $3
      `, [rejection_reason, adminId, id]);
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting document:', error);
    res.status(500).json({ error: 'Erreur lors du rejet du document' });
  }
});

// ============================================================================
// AUTO-CLASSIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/documents/:id/classify - Auto-classify document type using AI
 * Analyzes the document and automatically detects its type
 */
router.post('/:id/classify', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Check ownership
    const docResult = await pool.query(
      'SELECT id, type, file_url, front_image_url FROM documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL',
      [id, talentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const doc = docResult.rows[0];
    const fileUrl = doc.file_url || doc.front_image_url;

    if (!fileUrl) {
      return res.status(400).json({ error: 'Aucun fichier associé à ce document' });
    }

    // Classify document
    const classification = await classifyDocumentFromUrl(fileUrl);

    // Update document with classification
    await pool.query(`
      UPDATE documents SET
        type = $1,
        category = $2,
        title = CASE WHEN title IS NULL OR title = 'Document' THEN $3 ELSE title END,
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = NOW()
      WHERE id = $5
    `, [
      classification.detected_type,
      classification.category,
      classification.suggested_title,
      JSON.stringify({
        auto_classified: true,
        classification_confidence: classification.confidence,
        classification_details: classification.details,
        classification_reasoning: classification.reasoning
      }),
      id
    ]);

    // Queue for skill extraction if it's a professional/academic document
    const extractableTypes = ['CV', 'CERTIFICATE', 'DIPLOMA', 'PORTFOLIO', 'TRANSCRIPT', 'LICENSE'];
    if (extractableTypes.includes(classification.detected_type)) {
      queueDocumentForExtraction(id);
    }

    console.log(`📄 Document ${id} auto-classified as ${classification.detected_type} (${Math.round(classification.confidence * 100)}% confidence)`);

    res.json({
      success: true,
      data: {
        detected_type: classification.detected_type,
        category: classification.category,
        suggested_title: classification.suggested_title,
        confidence: classification.confidence,
        details: classification.details,
        reasoning: classification.reasoning
      }
    });
  } catch (error) {
    console.error('Error classifying document:', error);
    res.status(500).json({ error: 'Erreur lors de la classification du document' });
  }
});

/**
 * POST /api/documents/classify-base64 - Classify a document from base64 content
 * Useful for classifying before upload
 */
router.post('/classify-base64', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content, content_type } = req.body;

    if (!content || !content_type) {
      return res.status(400).json({ error: 'content et content_type sont requis' });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(content_type)) {
      return res.status(400).json({ error: 'Type de contenu non supporté' });
    }

    const classification = await classifyDocument(
      content,
      content_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
    );

    res.json({
      success: true,
      data: {
        detected_type: classification.detected_type,
        category: classification.category,
        suggested_title: classification.suggested_title,
        confidence: classification.confidence,
        details: classification.details,
        reasoning: classification.reasoning
      }
    });
  } catch (error) {
    console.error('Error classifying document:', error);
    res.status(500).json({ error: 'Erreur lors de la classification du document' });
  }
});

// ============================================================================
// SKILL EXTRACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/documents/:id/extract-skills - Trigger skill extraction for a document
 */
router.post('/:id/extract-skills', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Check ownership
    const docResult = await pool.query(
      'SELECT id, type, skills_extracted FROM documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL',
      [id, talentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const doc = docResult.rows[0];
    const extractableTypes = ['CV', 'CERTIFICATE', 'DIPLOMA', 'PORTFOLIO', 'TRANSCRIPT', 'LICENSE'];

    if (!extractableTypes.includes(doc.type)) {
      return res.status(400).json({
        error: 'Ce type de document ne supporte pas l\'extraction de compétences'
      });
    }

    const result = await processDocumentSkills(id);

    if (result.success) {
      res.json({
        success: true,
        message: `${result.skillsExtracted} compétences extraites`,
        skills_extracted: result.skillsExtracted
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error extracting skills:', error);
    res.status(500).json({ error: 'Erreur lors de l\'extraction des compétences' });
  }
});

/**
 * GET /api/documents/:id/skills - Get extracted skills for a document
 */
router.get('/:id/skills', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Check ownership
    const docResult = await pool.query(
      'SELECT id, skills_extracted, skills_extracted_at, summary FROM documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL',
      [id, talentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const doc = docResult.rows[0];

    // Get extracted skills
    const skillsResult = await pool.query(`
      SELECT ds.skill_name, ds.relevance_score, ds.is_auto_generated,
             s.canonical_name as matched_skill_name, s.type as skill_type
      FROM document_skills ds
      LEFT JOIN skills s ON s.id = ds.skill_id
      WHERE ds.document_id = $1
      ORDER BY ds.relevance_score DESC
    `, [id]);

    res.json({
      data: {
        document_id: id,
        skills_extracted: doc.skills_extracted,
        extracted_at: doc.skills_extracted_at,
        summary: doc.summary,
        skills: skillsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching document skills:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des compétences' });
  }
});

// ============================================================================
// UPLOAD URL ENDPOINT (same as KYC)
// ============================================================================

/**
 * POST /api/documents/upload-url - Get pre-signed URL for file upload
 */
router.post('/upload-url', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { filename, content_type, category = 'general' } = req.body;

    if (!filename || !content_type) {
      return res.status(400).json({ error: 'Nom de fichier et type de contenu requis' });
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(content_type)) {
      return res.status(400).json({
        error: 'Type de fichier non supporté. Types acceptés: JPEG, PNG, WebP, PDF'
      });
    }

    // Generate unique file ID
    const fileId = uuidv4();
    const extension = filename.split('.').pop()?.toLowerCase() || 'bin';
    const storagePath = `documents/${talentId}/${category}/${fileId}.${extension}`;

    // In development, return local paths
    // In production, this would generate S3/GCS pre-signed URLs
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      res.json({
        data: {
          upload_url: `/uploads/${storagePath}`,
          public_url: `/uploads/${storagePath}`,
          file_id: fileId,
          expires_in: 3600
        }
      });
    } else {
      // TODO: Implement actual cloud storage pre-signed URL generation
      res.json({
        data: {
          upload_url: `https://storage.example.com/${storagePath}?signed=true`,
          public_url: `https://cdn.example.com/${storagePath}`,
          file_id: fileId,
          expires_in: 3600
        }
      });
    }
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de l\'URL d\'upload' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultTitle(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] || 'Document';
}

export default router;
