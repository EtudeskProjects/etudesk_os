/**
 * Applications Talent Routes
 * Routes for job applicants (talents)
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../services/database';
import { authMiddleware, requireTalentProfile, AuthRequest } from '../../middleware/auth.middleware';
import { applicationLimiter } from '../../middleware/rateLimit.middleware';
import {
  validate,
  createApplicationSchema,
} from '../../middleware/validation.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  safeParseJson,
  logger,
} from '../../utils';
import { calculateMatchingScore, getMatchCategory } from '../../services/matching.service';
import * as pushService from '../../services/push-notification.service';

const router = Router();

/**
 * POST /api/applications - Submit an application
 * Rate limited: 20 applications per hour
 */
router.post('/', applicationLimiter, authMiddleware, requireTalentProfile, validate(createApplicationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { opportunity_id, cover_letter, custom_answers, answers, resume_url } = req.body;
    const applicationAnswers = custom_answers || answers;

    const oppResult = await pool.query(
      'SELECT id, status, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
      [opportunity_id]
    );

    if (oppResult.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunité non trouvée' });
    }

    const opportunity = oppResult.rows[0];
    if (opportunity.status !== 'OPEN') {
      return res.status(400).json({ error: 'Cette opportunité n\'accepte plus de candidatures' });
    }

    if (opportunity.deadline && new Date(opportunity.deadline) < new Date()) {
      return res.status(400).json({ error: 'La date limite de candidature est dépassée' });
    }

    // Check if user owns this opportunity
    const ownerCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
        AND om.talent_id = $2
        AND om.role IN ('OWNER', 'ADMIN')
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id IS NOT NULL)
    `, [opportunity_id, talentId]);

    if (ownerCheck.rows.length > 0) {
      throw createForbiddenError('Vous ne pouvez pas postuler à votre propre opportunité');
    }

    // Check for existing application
    const existingApp = await pool.query(
      'SELECT id FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2',
      [talentId, opportunity_id]
    );

    if (existingApp.rows.length > 0) {
      return res.status(409).json({
        error: 'Vous avez déjà postulé à cette opportunité',
        application_id: existingApp.rows[0].id
      });
    }

    const id = uuidv4();
    const result = await pool.query(`
      INSERT INTO opportunity_applications (
        id, talent_id, opportunity_id, cover_letter, custom_answers, cv_url, status, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', NOW())
      RETURNING *
    `, [id, talentId, opportunity_id, cover_letter || null, applicationAnswers ? JSON.stringify(applicationAnswers) : null, resume_url || null]);

    pushService.notifyNewApplication(id).catch(err => logger.error('Notification error:', err));

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Candidature soumise avec succès'
    });
  } catch (error) {
    handleRouteError(res, error, 'Error creating application');
  }
});

/**
 * GET /api/applications/me - Get my applications
 */
router.get('/me', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status } = req.query;
    const pagination = getPaginationParams(req);

    let query = `
      SELECT
        a.*,
        o.title as opportunity_title,
        o.slug as opportunity_slug,
        o.type as opportunity_type,
        o.status as opportunity_status,
        o.deadline as opportunity_deadline,
        o.location_type,
        o.locations,
        o.compensation_min,
        o.compensation_max,
        o.currency,
        o.cover_image_url as opportunity_cover_image_url,
        o.images as opportunity_images,
        o.contract_type as opportunity_contract_type,
        COALESCE(
          (SELECT json_agg(json_build_object('id', org.id, 'name', org.name, 'logo_url', org.logo_url))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.talent_id = $1
    `;
    const params: (string | number)[] = [talentId!];
    let paramIndex = 2;

    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM opportunity_applications
      WHERE talent_id = $1
      GROUP BY status
    `, [talentId]);

    const statusCounts: Record<string, number> = {};
    let totalCount = 0;
    countResult.rows.forEach(row => {
      const count = parseInt(row.count, 10);
      statusCounts[row.status] = count;
      totalCount += count;
    });

    // Transform flat data to nested structure
    const applications = result.rows.map(row => ({
      ...row,
      opportunity: {
        id: row.opportunity_id,
        title: row.opportunity_title,
        slug: row.opportunity_slug,
        type: row.opportunity_type,
        status: row.opportunity_status,
        deadline: row.opportunity_deadline,
        location_type: row.location_type,
        locations: row.locations,
        compensation_min: row.compensation_min,
        compensation_max: row.compensation_max,
        currency: row.currency,
        cover_image_url: row.opportunity_cover_image_url,
        images: row.opportunity_images,
        contract_type: row.opportunity_contract_type,
        organizations: row.organizations,
        organization: row.organizations && row.organizations.length > 0 ? row.organizations[0] : null,
      },
    }));

    res.json({
      data: applications,
      count: totalCount,
      statusCounts
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching my applications');
  }
});

/**
 * GET /api/applications/check/:opportunityId - Check if already applied
 */
router.get('/check/:opportunityId', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { opportunityId } = req.params;

    const applicationResult = await pool.query(
      'SELECT id, status, applied_at FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2',
      [talentId, opportunityId]
    );

    const ownerCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
        AND om.talent_id = $2
        AND om.role IN ('OWNER', 'ADMIN')
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id IS NOT NULL)
    `, [opportunityId, talentId]);

    const isOwner = ownerCheck.rows.length > 0;
    const hasApplied = applicationResult.rows.length > 0;

    res.json({
      data: {
        applied: hasApplied,
        application_id: applicationResult.rows[0]?.id || null,
        application_status: applicationResult.rows[0]?.status || null,
        applied_at: applicationResult.rows[0]?.applied_at || null,
        is_owner: isOwner,
        can_apply: !isOwner && !hasApplied
      }
    });
  } catch (error) {
    handleRouteError(res, error, 'Error checking application');
  }
});

/**
 * GET /api/applications/:id - Get application by ID
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        o.id as opp_id,
        o.title as opportunity_title,
        o.slug as opportunity_slug,
        o.type as opportunity_type,
        o.status as opportunity_status,
        o.deadline as opportunity_deadline,
        o.location_type,
        o.locations,
        o.compensation_min,
        o.compensation_max,
        o.currency,
        o.summary as opportunity_summary,
        o.requirements as opportunity_requirements,
        o.application_questions,
        COALESCE(
          (SELECT json_agg(json_build_object('id', org.id, 'name', org.name, 'logo_url', org.logo_url, 'types', org.types))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations,
        t.id as talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_display_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.email as talent_email,
        t.phone as talent_phone,
        t.avatar_url as talent_avatar,
        t.bio as talent_bio,
        t.city as talent_city,
        t.country as talent_country,
        t.region as talent_region,
        t.remote_ready as talent_remote_ready,
        t.sectors as talent_sectors,
        t.profile_tags as talent_profile_tags,
        (SELECT ARRAY_AGG(canonical_name) FROM talent_skills WHERE talent_id = t.id) as talent_skills,
        o.contract_type,
        o.work_rhythm,
        o.cover_image_url as opportunity_cover_image,
        o.images as opportunity_images,
        (SELECT org.sectors FROM opportunity_posters op2 JOIN organizations org ON op2.poster_organization_id = org.id WHERE op2.opportunity_id = o.id LIMIT 1) as org_sectors
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN talents t ON a.talent_id = t.id
      WHERE a.id = $1 AND o.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Candidature');
    }

    const row = result.rows[0];

    const isApplicant = row.talent_id === talentId;

    let isOrgMember = false;
    if (!isApplicant && talentId) {
      const accessCheck = await pool.query(`
        SELECT 1 FROM opportunity_posters op
        LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
        WHERE op.opportunity_id = $1
        AND (op.poster_talent_id = $2 OR om.talent_id = $2)
      `, [row.opp_id, talentId]);
      isOrgMember = accessCheck.rows.length > 0;
    }

    if (!isApplicant && !isOrgMember) {
      throw createForbiddenError('Accès non autorisé à cette candidature');
    }

    let matchScore: number | undefined;
    let matchCategory: string | undefined;
    try {
      const scoreResult = await calculateMatchingScore({
        id: row.id,
        talent_id: row.talent_id,
        opportunity_id: row.opp_id,
        talent: {
          city: row.talent_city,
          region: row.talent_region,
          country: row.talent_country,
          remote_ready: row.talent_remote_ready,
          skills: row.talent_skills || [],
          sectors: row.talent_sectors || [],
          profile_tags: row.talent_profile_tags || [],
        },
        opportunity: {
          location_type: row.location_type,
          locations: row.locations,
          contract_type: row.contract_type,
          work_rhythm: row.work_rhythm,
          type: row.opportunity_type,
        },
        organization: { sectors: row.org_sectors || [] },
      });
      matchScore = scoreResult.finalScore;
      matchCategory = getMatchCategory(scoreResult.finalScore);
    } catch (err) {
      logger.error('Error computing matching score:', err);
    }

    const application = {
      ...row,
      resume_url: row.cv_url,
      rating: row.star_rating || 0,
      internal_notes: row.internal_notes || '',
      matchScore,
      matchCategory,
      opportunity: {
        id: row.opp_id,
        title: row.opportunity_title,
        slug: row.opportunity_slug,
        type: row.opportunity_type,
        status: row.opportunity_status,
        deadline: row.opportunity_deadline,
        location_type: row.location_type,
        locations: row.locations,
        compensation_min: row.compensation_min,
        compensation_max: row.compensation_max,
        currency: row.currency,
        summary: row.opportunity_summary,
        requirements: row.opportunity_requirements,
        application_questions: row.application_questions,
        organizations: row.organizations,
        cover_image_url: row.opportunity_cover_image,
        images: row.opportunity_images,
        contract_type: row.contract_type,
      },
      talent: {
        id: row.talent_id,
        display_name: row.talent_display_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        email: row.talent_email,
        phone: row.talent_phone,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar,
        bio: row.talent_bio,
        headline: row.talent_bio,
        city: row.talent_city,
        country: row.talent_country,
      },
      answers: safeParseJson(row.custom_answers, []),
    };

    res.json({ data: application });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching application');
  }
});

/**
 * PUT /api/applications/:id/withdraw - Withdraw application
 */
router.put('/:id/withdraw', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id, status FROM opportunity_applications WHERE id = $1 AND talent_id = $2',
      [id, talentId]
    );

    if (existing.rows.length === 0) {
      throw createNotFoundError('Candidature');
    }

    if (['ACCEPTED', 'REJECTED'].includes(existing.rows[0].status)) {
      return res.status(400).json({ error: 'Impossible de retirer une candidature déjà traitée' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET status = 'REJECTED', updated_at = NOW()
      WHERE id = $1 AND talent_id = $2
      RETURNING *
    `, [id, talentId]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Candidature retirée'
    });
  } catch (error) {
    handleRouteError(res, error, 'Error withdrawing application');
  }
});

/**
 * DELETE /api/applications/:id - Delete application (hard delete)
 * Allows talent to delete and reapply later
 */
router.delete('/:id', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id, status FROM opportunity_applications WHERE id = $1 AND talent_id = $2',
      [id, talentId]
    );

    if (existing.rows.length === 0) {
      throw createNotFoundError('Candidature');
    }

    // First delete related messages
    await pool.query('DELETE FROM application_messages WHERE application_id = $1', [id]);
    // Then delete the application
    await pool.query('DELETE FROM opportunity_applications WHERE id = $1', [id]);

    res.json({ success: true, message: 'Candidature supprimée. Vous pouvez postuler à nouveau.' });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting application');
  }
});

export default router;
