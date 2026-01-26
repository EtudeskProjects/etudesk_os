import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate, createOpportunitySchema } from '../middleware/validation.middleware';
import {
  generateOpportunitySuggestion,
  canGenerate,
  GenerationInput,
} from '../services/opportunity-generation.service';
import { onOpportunityUpdate } from '../services/embedding.service';
import { autoModerationService } from '../services/auto-moderation.service';

// Type for SQL query parameters
type QueryParam = string | number | boolean | null | Date;

const router = Router();

// ============================================================================
// AI GENERATION ROUTES
// ============================================================================

/**
 * POST /api/opportunities/generate - Generate opportunity suggestions using AI
 * Requires: Auth + organization_id, title, type
 * Returns: Structured suggestions to prefill the form
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { title, type, organization_id, existing_data } = req.body;

    // Validate minimum required fields
    if (!canGenerate(title, type)) {
      return res.status(400).json({
        error: 'Title (min 3 chars) and type are required',
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: 'organization_id is required',
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
      return res.status(403).json({
        error: 'Vous n\'êtes pas membre de cette organisation',
      });
    }

    // Generate suggestions
    const input: GenerationInput = {
      title,
      type,
      organization_id,
      existing_data,
    };

    const result = await generateOpportunitySuggestion(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Échec de la génération',
      });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error generating opportunity suggestions:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération des suggestions',
    });
  }
});

/**
 * GET /api/opportunities/can-generate - Check if generation is possible
 * Query params: title, type
 */
router.get('/can-generate', (req: Request, res: Response) => {
  const { title, type } = req.query;
  const result = canGenerate(title as string, type as string);
  res.json({ canGenerate: result });
});

// GET /api/opportunities - List all opportunities
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, type, location_type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT o.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', org.id,
            'name', org.name,
            'logo_url', org.logo_url,
            'type', org.type,
            'headquarters_city', org.headquarters_city,
            'headquarters_country', org.headquarters_country,
            'verification_status', org.verification_status
          ))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations
      FROM opportunities o
      WHERE o.deleted_at IS NULL
    `;
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND o.status = $${paramIndex++}`;
      params.push(status as string);
    }
    if (type) {
      query += ` AND o.type = $${paramIndex++}`;
      params.push(type as string);
    }
    if (location_type) {
      query += ` AND o.location_type = $${paramIndex++}`;
      params.push(location_type as string);
    }

    query += ` ORDER BY o.posted_at DESC NULLS LAST, o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// GET /api/opportunities/organization/:orgId - Get opportunities by organization
// NOTE: This route MUST be defined BEFORE /:id to prevent route conflicts
router.get('/organization/:orgId', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        o.*,
        (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count,
        (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id AND status = 'SUBMITTED') as pending_count,
        (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id AND viewed_at IS NULL) as unread_count
      FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
    `;
    const params: QueryParam[] = [orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND o.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching organization opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// GET /api/opportunities/:id - Get single opportunity
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid opportunity ID format' });
    }

    const result = await pool.query(`
      SELECT o.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', org.id,
            'name', org.name,
            'logo_url', org.logo_url,
            'type', org.type,
            'headquarters_city', org.headquarters_city,
            'headquarters_country', org.headquarters_country,
            'verification_status', org.verification_status
          ))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations,
        COALESCE(
          (SELECT json_agg(json_build_object('id', s.id, 'name', s.canonical_name, 'is_required', os.is_required))
           FROM opportunity_skills os
           JOIN skills s ON os.skill_id = s.id
           WHERE os.opportunity_id = o.id),
          '[]'
        ) as skills,
        (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count,
        COALESCE(o.views_count, 0) as views_count
      FROM opportunities o
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Normalize sectors array (ensure it's always an array, not null)
    const opportunity = result.rows[0];
    if (opportunity.sectors === null || opportunity.sectors === undefined) {
      opportunity.sectors = [];
    }

    res.json({ data: opportunity });
  } catch (error: any) {
    console.error('Error fetching opportunity:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch opportunity', details: error.message });
  }
});

// POST /api/opportunities/:id/view - Increment view count
router.post('/:id/view', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid opportunity ID format' });
    }

    // Check if opportunity exists
    const checkResult = await pool.query(
      'SELECT id FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Increment views_count
    const result = await pool.query(`
      UPDATE opportunities 
      SET views_count = COALESCE(views_count, 0) + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING views_count
    `, [id]);

    res.json({ success: true, views_count: result.rows[0]?.views_count || 0 });
  } catch (error: any) {
    console.error('Error incrementing views:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to increment views', details: error.message });
  }
});

// POST /api/opportunities - Create opportunity
// Requires authentication
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
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        title,
        summary,
        requirements,
        nice_to_have,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Opportunity creation rejected: ${moderationError.message}`);
      return res.status(400).json({ 
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    // Si organization_id fourni, vérifier que l'utilisateur est membre
    if (organization_id) {
      const memberCheck = await pool.query(`
        SELECT 1 FROM organization_members
        WHERE organization_id = $1 AND talent_id = $2
      `, [organization_id, talentId]);

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });
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
        organization_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW()
      ) RETURNING *
    `, [
      id, title, slug, type || null, contract_type || null, work_rhythm || null, summary || null, requirements || null, nice_to_have || null,
      compensation_min || null, compensation_max || null, currency || null, compensation_frequency || null,
      location_type || null, locations ? JSON.stringify(locations) : null, postedAt, deadline || null, start_date || null, duration || null,
      status, cover_image_url || null, cv_required || false,
      application_questions && application_questions.length > 0 ? JSON.stringify(application_questions) : null,
      sectors || null, images || null, attachments ? JSON.stringify(attachments) : null,
      organization_id || null
    ]);

    // Link to organization or talent in opportunity_posters
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

    // Generate embedding for semantic search (async, non-blocking)
    onOpportunityUpdate(id).catch(err =>
      console.error('Failed to generate opportunity embedding:', err)
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({ error: 'Failed to create opportunity' });
  }
});

// PUT /api/opportunities/:id - Update opportunity
// Requires authentication + authorization
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
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
      status,
      cover_image_url,
      cv_required,
      application_questions,
      sectors,
      images,
      attachments,
    } = req.body;

    // Check if opportunity exists
    const existingResult = await pool.query('SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Vérifier que l'utilisateur a le droit de modifier cette opportunité
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour modifier cette opportunité' });
    }

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        title,
        summary,
        requirements,
        nice_to_have,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Opportunity update rejected for ${id}: ${moderationError.message}`);
      return res.status(400).json({ 
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    const existing = existingResult.rows[0];
    const newStatus = status || existing.status;
    const postedAt = newStatus === 'OPEN' && existing.status !== 'OPEN' ? new Date() : existing.posted_at;

    // Properly handle undefined values - use existing values from database
    const finalSectors = sectors !== undefined ? sectors : existing.sectors;
    const finalImages = images !== undefined ? images : existing.images;
    const finalLocations = locations !== undefined ? JSON.stringify(locations) : existing.locations;
    const finalApplicationQuestions = application_questions !== undefined ? JSON.stringify(application_questions) : existing.application_questions;
    const finalAttachments = attachments !== undefined ? JSON.stringify(attachments) : existing.attachments;

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
        updated_at = NOW()
      WHERE id = $25 AND deleted_at IS NULL
      RETURNING *
    `, [
      title, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
      compensation_min, compensation_max, currency, compensation_frequency,
      location_type, finalLocations, postedAt, deadline, start_date, duration,
      newStatus, cover_image_url, cv_required, finalApplicationQuestions,
      finalSectors, finalImages, finalAttachments, id
    ]);

    // Update embedding for semantic search (async, non-blocking)
    onOpportunityUpdate(id).catch(err =>
      console.error('Failed to update opportunity embedding:', err)
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating opportunity:', error);
    res.status(500).json({ error: 'Failed to update opportunity' });
  }
});

// DELETE /api/opportunities/:id - Soft delete opportunity
// Requires authentication + authorization
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a le droit de supprimer cette opportunité
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour supprimer cette opportunité' });
    }

    const result = await pool.query(`
      UPDATE opportunities SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json({ success: true, message: 'Opportunity deleted' });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    res.status(500).json({ error: 'Failed to delete opportunity' });
  }
});

// ============================================================================
// APPLICATION ROUTES (Nested under opportunities)
// ============================================================================

/**
 * GET /api/opportunities/:id/applications - Get applications for an opportunity
 * Requires: Auth (must be owner/member of posting organization)
 */
router.get('/:id/applications', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a accès à cette opportunité
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette opportunité' });
    }

    let query = `
      SELECT
        a.*,
        t.id as talent_id,
        t.display_name as talent_display_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.avatar_url as talent_avatar,
        t.email as talent_email,
        t.city as talent_city,
        t.country as talent_country,
        t.bio as talent_bio
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      WHERE a.opportunity_id = $1
    `;
    const params: (string | number)[] = [id];
    let paramIndex = 2;

    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Compter par statut
    const countResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM opportunity_applications
      WHERE opportunity_id = $1
      GROUP BY status
    `, [id]);

    const statusCounts: Record<string, number> = {};
    countResult.rows.forEach((row: { status: string; count: string }) => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    // Transform to nested talent object for frontend compatibility
    const applications = result.rows.map(row => ({
      ...row,
      talent: {
        id: row.talent_id,
        display_name: row.talent_display_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar, // Alias for frontend
        email: row.talent_email,
        city: row.talent_city,
        country: row.talent_country,
        bio: row.talent_bio,
        headline: row.talent_bio, // Use bio as headline
      },
    }));

    res.json({
      data: applications,
      count: result.rowCount,
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching opportunity applications:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures' });
  }
});

/**
 * GET /api/opportunities/:id/applications/counts - Get application counts by status
 * Requires: Auth (must be owner/member of posting organization)
 */
router.get('/:id/applications/counts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a accès à cette opportunité
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM opportunity_applications
      WHERE opportunity_id = $1
      GROUP BY status
    `, [id]);

    const counts: Record<string, number> = {
      SUBMITTED: 0,
      IN_REVIEW: 0,
      ACCEPTED: 0,
      REJECTED: 0,
    };

    result.rows.forEach((row: { status: string; count: string }) => {
      counts[row.status] = parseInt(row.count, 10);
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ data: counts, total });
  } catch (error) {
    console.error('Error fetching application counts:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

export default router;
