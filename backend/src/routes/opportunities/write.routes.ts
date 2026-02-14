/**
 * Opportunities Write Routes
 * POST, PUT, DELETE operations for opportunities
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { validate, createOpportunitySchema, updateOpportunitySchema, uuidParamSchema } from '../../middleware/validation.middleware';
import {
  generateOpportunitySuggestion,
  canGenerate,
  GenerationInput,
} from '../../services/opportunity-generation.service';
import { onOpportunityUpdate } from '../../services/embedding.service';
import { autoModerationService } from '../../services/auto-moderation.service';
import {
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  logger,
} from '../../utils';

const router = Router();

/**
 * POST /api/opportunities/generate - Generate opportunity suggestions using AI
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { title, type, organization_id, existing_data } = req.body;

    if (!canGenerate(title, type)) {
      return res.status(400).json({
        error: req.t('opportunities:titleTypeRequired'),
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: req.t('opportunities:organizationIdRequired'),
        canGenerate: false,
      });
    }

    // Verify user is a member of the organization
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND talent_id = $2`,
      [organization_id, talentId]
    );

    if (memberCheck.rows.length === 0) {
      throw createForbiddenError(req.t('opportunities:notMemberOrg'));
    }

    const input: GenerationInput = { title, type, organization_id, existing_data };
    const result = await generateOpportunitySuggestion(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || req.t('opportunities:generationFailed'),
      });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    handleRouteError(res, error, 'Error generating opportunity suggestions');
  }
});

/**
 * POST /api/opportunities - Create opportunity
 */
router.post('/', authMiddleware, validate(createOpportunitySchema), async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const {
      title,
      type,
      contract_type,
      work_rhythm,
      summary,
      requirements,
      nice_to_have,
      compensation_min,
      compensation_max,
      currency,
      compensation_frequency,
      location_type,
      locations,
      deadline,
      start_date,
      duration,
      status = 'DRAFT',
      organization_id,
      cover_image_url,
      cv_required,
      application_questions,
      sectors,
      images,
      attachments,
      visibility,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: req.t('opportunities:titleRequired') });
    }

    // Content moderation
    try {
      await autoModerationService.assertContentApproved({
        title, summary, requirements, nice_to_have,
      });
    } catch (moderationError: unknown) {
      const err = moderationError as { message: string; flaggedField?: string };
      logger.info(`[Moderation] Opportunity creation rejected: ${err.message}`);
      return res.status(400).json({
        error: err.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: err.flaggedField,
      });
    }

    // Verify organization membership if provided
    if (organization_id) {
      const memberCheck = await pool.query(
        `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
        [organization_id, talentId]
      );
      if (memberCheck.rows.length === 0) {
        throw createForbiddenError(req.t('opportunities:notMemberOrg'));
      }
    }

    const id = uuidv4();
    const slug = generateSlug(title) + '-' + id.slice(0, 8);
    const postedAt = status === 'OPEN' ? new Date() : null;

    const result = await pool.query(`
      INSERT INTO opportunities (
        id, title, slug, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
        compensation_min, compensation_max, currency, compensation_frequency,
        location_type, locations, posted_at, deadline, start_date, duration,
        status, cover_image_url, cv_required, application_questions, sectors, images, attachments,
        organization_id, visibility, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW(), NOW()
      ) RETURNING *
    `, [
      id, title, slug, type || null, contract_type || null, work_rhythm || null,
      summary || null, requirements || null, nice_to_have || null,
      compensation_min || null, compensation_max || null, currency || null, compensation_frequency || null,
      location_type || null, locations ? JSON.stringify(locations) : null, postedAt,
      deadline || null, start_date || null, duration || null,
      status, cover_image_url || null, cv_required || false,
      application_questions?.length > 0 ? JSON.stringify(application_questions) : null,
      sectors || null, images || null, attachments ? JSON.stringify(attachments) : null,
      organization_id || null, visibility || 'PUBLIC'
    ]);

    // Link to organization or talent
    if (organization_id) {
      await pool.query(`
        INSERT INTO opportunity_posters (opportunity_id, poster_organization_id, role, posted_at)
        VALUES ($1, $2, 'POSTER', NOW())
      `, [id, organization_id]);
    } else if (talentId) {
      await pool.query(`
        INSERT INTO opportunity_posters (opportunity_id, poster_talent_id, role, posted_at)
        VALUES ($1, $2, 'POSTER', NOW())
      `, [id, talentId]);
    }

    // Generate embedding (async)
    onOpportunityUpdate(id).catch(err => logger.error('Failed to generate opportunity embedding:', err));

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error creating opportunity');
  }
});

/**
 * PUT /api/opportunities/:id - Update opportunity
 */
router.put('/:id', authMiddleware, validate(updateOpportunitySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const {
      title, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
      compensation_min, compensation_max, currency, compensation_frequency,
      location_type, locations, deadline, start_date, duration, status,
      cover_image_url, cv_required, application_questions, sectors, images, attachments,
      visibility,
    } = req.body;

    // Check if opportunity exists
    const existingResult = await pool.query(
      'SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (existingResult.rows.length === 0) {
      throw createNotFoundError('Opportunity');
    }

    // Check authorization
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('opportunities:notAuthorizedModify'));
    }

    // Content moderation
    try {
      await autoModerationService.assertContentApproved({
        title, summary, requirements, nice_to_have,
      });
    } catch (moderationError: unknown) {
      const err = moderationError as { message: string; flaggedField?: string };
      return res.status(400).json({
        error: err.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: err.flaggedField,
      });
    }

    const existing = existingResult.rows[0];
    const newStatus = status || existing.status;
    const postedAt = newStatus === 'OPEN' && existing.status !== 'OPEN' ? new Date() : existing.posted_at;

    const safeStringify = (val: unknown) => typeof val === 'string' ? val : JSON.stringify(val);
    const finalSectors = sectors !== undefined ? sectors : existing.sectors;
    const finalImages = images !== undefined ? images : existing.images;
    const finalLocations = locations !== undefined ? JSON.stringify(locations) : safeStringify(existing.locations);
    const finalQuestions = application_questions !== undefined ? JSON.stringify(application_questions) : safeStringify(existing.application_questions);
    const finalAttachments = attachments !== undefined ? JSON.stringify(attachments) : safeStringify(existing.attachments);

    const result = await pool.query(`
      UPDATE opportunities SET
        title = COALESCE($1, title),
        type = COALESCE($2, type),
        contract_type = COALESCE($3, contract_type),
        work_rhythm = COALESCE($4, work_rhythm),
        summary = COALESCE($5, summary),
        requirements = COALESCE($6, requirements),
        nice_to_have = COALESCE($7, nice_to_have),
        compensation_min = COALESCE($8, compensation_min),
        compensation_max = COALESCE($9, compensation_max),
        currency = COALESCE($10, currency),
        compensation_frequency = COALESCE($11, compensation_frequency),
        location_type = COALESCE($12, location_type),
        locations = $13,
        posted_at = $14,
        deadline = COALESCE($15, deadline),
        start_date = COALESCE($16, start_date),
        duration = COALESCE($17, duration),
        status = COALESCE($18, status),
        cover_image_url = COALESCE($19, cover_image_url),
        cv_required = COALESCE($20, cv_required),
        application_questions = $21,
        sectors = $22,
        images = $23,
        attachments = $24,
        visibility = COALESCE($25, visibility),
        updated_at = NOW()
      WHERE id = $26 AND deleted_at IS NULL
      RETURNING *
    `, [
      title, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
      compensation_min, compensation_max, currency, compensation_frequency,
      location_type, finalLocations, postedAt, deadline, start_date, duration,
      newStatus, cover_image_url, cv_required, finalQuestions,
      finalSectors, finalImages, finalAttachments, visibility, id
    ]);

    // Update embedding (async)
    onOpportunityUpdate(id).catch(err => logger.error('Failed to update opportunity embedding:', err));

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating opportunity');
  }
});

/**
 * DELETE /api/opportunities/:id - Soft delete opportunity
 */
router.delete('/:id', authMiddleware, validate(uuidParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check authorization
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('opportunities:notAuthorizedDelete'));
    }

    const result = await pool.query(`
      UPDATE opportunities SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Opportunity');
    }

    res.json({ success: true, message: req.t('opportunities:deleted') });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting opportunity');
  }
});

export default router;
