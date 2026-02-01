import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../services/database';
import { authMiddleware, requireTalentProfile, AuthRequest } from '../middleware/auth.middleware';
import { applicationLimiter } from '../middleware/rateLimit.middleware';
import * as pushService from '../services/push-notification.service';
import {
  validate,
  createApplicationSchema,
  updateApplicationStatusSchema,
  updateApplicationNotesSchema,
  updateApplicationRatingSchema,
  scheduleInterviewSchema,
  bulkUpdateStatusSchema,
  uuidParamSchema,
  opportunityIdParamSchema
} from '../middleware/validation.middleware';
import { rankApplications } from '../services/matching.service';
import { getApplicationRecommendation } from '../services/recommendation.service';
import { safeParseJson } from '../utils';

const router = Router();

// ============================================================================
// TALENT ENDPOINTS (Pour les candidats)
// ============================================================================

/**
 * POST /api/applications - Soumettre une candidature
 * Requires: Auth + Talent Profile
 * Rate limited: 20 applications per hour
 */
router.post('/', applicationLimiter, authMiddleware, requireTalentProfile, validate(createApplicationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    // Accept both "answers" and "custom_answers" for compatibility
    const { opportunity_id, cover_letter, custom_answers, answers, resume_url } = req.body;
    const applicationAnswers = custom_answers || answers;

    // Vérifier que l'opportunité existe et est ouverte
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

    // Vérifier que l'utilisateur n'est pas le propriétaire de l'opportunité
    // (ni en tant que poster direct, ni en tant que membre de l'organisation)
    const ownerCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunity_id, talentId]);

    if (ownerCheck.rows.length > 0) {
      return res.status(403).json({ error: 'Vous ne pouvez pas postuler à votre propre opportunité' });
    }

    // Vérifier si déjà candidaté
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

    // Créer la candidature
    const id = uuidv4();
    const result = await pool.query(`
      INSERT INTO opportunity_applications (
        id, talent_id, opportunity_id, cover_letter, custom_answers, cv_url, status, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
      RETURNING *
    `, [id, talentId, opportunity_id, cover_letter || null, applicationAnswers ? JSON.stringify(applicationAnswers) : null, resume_url || null]);

    // Notify organization about new application
    pushService.notifyNewApplication(id).catch(err => console.error('Notification error:', err));

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Candidature soumise avec succès'
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission de la candidature' });
  }
});

/**
 * GET /api/applications/me - Obtenir mes candidatures
 * Requires: Auth + Talent Profile
 */
router.get('/me', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

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
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Compter par statut
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

    // Transform flat data to nested structure for frontend compatibility
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
        organizations: row.organizations,
        // For convenience, also provide first organization as 'organization'
        organization: row.organizations && row.organizations.length > 0 ? row.organizations[0] : null,
      },
    }));

    res.json({
      data: applications,
      count: totalCount,
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching my applications:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures' });
  }
});

/**
 * GET /api/applications/check/:opportunityId - Vérifier si déjà candidaté et si peut postuler
 * Requires: Auth + Talent Profile
 */
router.get('/check/:opportunityId', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { opportunityId } = req.params;

    // Vérifier si déjà candidaté
    const applicationResult = await pool.query(
      'SELECT id, status, applied_at FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2',
      [talentId, opportunityId]
    );

    // Vérifier si l'utilisateur est le propriétaire de l'opportunité
    const ownerCheck = await pool.query(`
      SELECT 1 FROM opportunity_posters op
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE op.opportunity_id = $1
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
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
    console.error('Error checking application:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

/**
 * GET /api/applications/:id - Obtenir une candidature par ID
 * Requires: Auth (candidat ou membre de l'organisation qui a posté)
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // First, get the application with all details
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
          (SELECT json_agg(json_build_object('id', org.id, 'name', org.name, 'logo_url', org.logo_url, 'type', org.type))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations,
        t.id as talent_id,
        t.display_name as talent_display_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.email as talent_email,
        t.phone as talent_phone,
        t.avatar_url as talent_avatar,
        t.bio as talent_bio,
        t.city as talent_city,
        t.country as talent_country
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN talents t ON a.talent_id = t.id
      WHERE a.id = $1 AND o.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidature non trouvée' });
    }

    const row = result.rows[0];

    // Check access: either the applicant or organization member
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
      return res.status(403).json({ error: 'Accès non autorisé à cette candidature' });
    }

    // Structure the response with nested objects
    const application = {
      ...row,
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
      },
      talent: {
        id: row.talent_id,
        display_name: row.talent_display_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        email: row.talent_email,
        phone: row.talent_phone,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar, // Map avatar_url to profile_picture_url for frontend compatibility
        bio: row.talent_bio,
        headline: row.talent_bio, // Use bio as headline for frontend compatibility
        city: row.talent_city,
        country: row.talent_country,
      },
      answers: safeParseJson(row.custom_answers, []),
    };

    res.json({ data: application });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la candidature' });
  }
});

/**
 * PUT /api/applications/:id/withdraw - Retirer une candidature
 * Requires: Auth + Talent Profile (doit être le propriétaire)
 */
router.put('/:id/withdraw', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Vérifier que la candidature existe et appartient au talent
    const existing = await pool.query(
      'SELECT id, status FROM opportunity_applications WHERE id = $1 AND talent_id = $2',
      [id, talentId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Candidature non trouvée' });
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
    console.error('Error withdrawing application:', error);
    res.status(500).json({ error: 'Erreur lors du retrait de la candidature' });
  }
});

/**
 * DELETE /api/applications/:id - Supprimer une candidature (hard delete)
 * Allows talent to delete and reapply later
 * Requires: Auth + Talent Profile (doit être le propriétaire)
 */
router.delete('/:id', authMiddleware, requireTalentProfile, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    // Vérifier que la candidature existe et appartient au talent
    const existing = await pool.query(
      'SELECT id, status FROM opportunity_applications WHERE id = $1 AND talent_id = $2',
      [id, talentId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Candidature non trouvée' });
    }

    // Hard delete - allow deletion for any status so talent can reapply
    // First delete related messages
    await pool.query('DELETE FROM application_messages WHERE application_id = $1', [id]);
    // Then delete the application
    await pool.query('DELETE FROM opportunity_applications WHERE id = $1', [id]);

    res.json({ success: true, message: 'Candidature supprimée. Vous pouvez postuler à nouveau.' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la candidature' });
  }
});

// ============================================================================
// ORGANIZATION ENDPOINTS (Pour les recruteurs)
// ============================================================================

/**
 * GET /api/applications/opportunity/:opportunityId - Candidatures pour une opportunité
 * Requires: Auth (doit être membre de l'organisation qui a posté l'opportunité)
 */
router.get('/opportunity/:opportunityId', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a accès à cette opportunité
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette opportunité' });
    }

    let query = `
      SELECT
        a.*,
        t.display_name as talent_name,
        t.avatar_url as talent_avatar,
        t.email as talent_email,
        t.city as talent_city,
        t.country as talent_country
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      WHERE a.opportunity_id = $1
    `;
    const params: (string | number)[] = [opportunityId];
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
    `, [opportunityId]);

    const statusCounts: Record<string, number> = {};
    countResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    res.json({
      data: result.rows,
      count: result.rowCount,
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching opportunity applications:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures' });
  }
});

/**
 * GET /api/applications/opportunity/:opportunityId/ranked - Candidatures classées par pertinence
 * Returns applications grouped by status, sorted by matching score within each group
 * Requires: Auth (doit être membre de l'organisation qui a posté l'opportunité)
 */
router.get('/opportunity/:opportunityId/ranked', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status, includeRecommendations = 'false' } = req.query;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a accès à cette opportunité
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette opportunité' });
    }

    // Rank applications using the matching service
    const rankedApplications = await rankApplications(opportunityId, status as string | undefined);

    // Group by status for easy frontend consumption
    const grouped: Record<string, typeof rankedApplications> = {};
    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'];

    for (const app of rankedApplications) {
      const appStatus = app.status || 'SUBMITTED';
      if (!grouped[appStatus]) {
        grouped[appStatus] = [];
      }
      grouped[appStatus].push(app);
    }

    // Compter par statut
    const statusCounts: Record<string, number> = {};
    for (const s of statusOrder) {
      statusCounts[s] = grouped[s]?.length || 0;
    }

    res.json({
      data: status ? (grouped[status as string] || []) : rankedApplications,
      grouped,
      count: rankedApplications.length,
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching ranked applications:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures classées' });
  }
});

/**
 * GET /api/applications/:id/recommendation - Obtenir la recommandation AI pour une candidature
 * Generates or returns cached 30-word recommendation
 * Requires: Auth (doit être membre de l'organisation)
 */
router.get('/:id/recommendation', authMiddleware, validate(uuidParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Vérifier l'accès (organisation seulement)
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const recommendation = await getApplicationRecommendation(id);

    if (!recommendation) {
      return res.status(404).json({ error: 'Impossible de générer une recommandation' });
    }

    res.json({
      success: true,
      data: {
        application_id: id,
        recommendation
      }
    });
  } catch (error) {
    console.error('Error getting recommendation:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la recommandation' });
  }
});

/**
 * PUT /api/applications/:id/status - Mettre à jour le statut d'une candidature
 * Requires: Auth (doit être membre de l'organisation)
 */
router.put('/:id/status', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const talentId = req.talentId;

    // Vérifier que l'utilisateur a accès à cette candidature
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette candidature' });
    }

    // Get old status for notification
    const oldStatusResult = await pool.query(
      'SELECT status FROM opportunity_applications WHERE id = $1',
      [id]
    );
    const oldStatus = oldStatusResult.rows[0]?.status;

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    // Notify talent about status change
    if (oldStatus && oldStatus !== status) {
      pushService.notifyApplicationStatusChanged(id, oldStatus, status)
        .catch(err => console.error('Notification error:', err));
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Statut mis à jour'
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * PUT /api/applications/:id/notes - Ajouter des notes internes
 * Requires: Auth (doit être membre de l'organisation)
 */
router.put('/:id/notes', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationNotesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const talentId = req.talentId;

    // Vérifier l'accès
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET internal_notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [notes, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des notes' });
  }
});

/**
 * PUT /api/applications/:id/rating - Noter une candidature
 * Requires: Auth (doit être membre de l'organisation)
 */
router.put('/:id/rating', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationRatingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const talentId = req.talentId;

    // Vérifier l'accès
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET star_rating = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [rating, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la note' });
  }
});

/**
 * PUT /api/applications/:id/view - Marquer comme vu
 * Requires: Auth (doit être membre de l'organisation)
 */
router.put('/:id/view', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Vérifier l'accès
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET viewed_at = COALESCE(viewed_at, NOW()), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error marking as viewed:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * PUT /api/applications/:id/interview - Planifier un entretien
 * Requires: Auth (doit être membre de l'organisation)
 */
router.put('/:id/interview', authMiddleware, validate(uuidParamSchema, 'params'), validate(scheduleInterviewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { interview_scheduled_at, interview_type, interview_location, interview_notes } = req.body;
    const talentId = req.talentId;

    // Vérifier l'accès
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET
        interview_scheduled_at = $1,
        interview_type = $2,
        interview_location = $3,
        interview_notes = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [interview_scheduled_at, interview_type || null, interview_location || null, interview_notes || null, id]);

    // Notify talent about interview scheduled
    pushService.notifyInterviewScheduled(id, interview_scheduled_at, interview_type, interview_location)
      .catch(err => console.error('Notification error:', err));

    res.json({ success: true, data: result.rows[0], message: 'Entretien planifié' });
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ error: 'Erreur lors de la planification de l\'entretien' });
  }
});

/**
 * DELETE /api/applications/:id/interview - Annuler un entretien
 * Requires: Auth (doit être membre de l'organisation)
 */
router.delete('/:id/interview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Vérifier l'accès
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET
        interview_scheduled_at = NULL,
        interview_type = NULL,
        interview_location = NULL,
        interview_notes = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({ success: true, data: result.rows[0], message: 'Entretien annulé' });
  } catch (error) {
    console.error('Error canceling interview:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'entretien' });
  }
});

/**
 * PUT /api/applications/bulk/status - Mise à jour en masse du statut
 * Requires: Auth
 */
router.put('/bulk/status', authMiddleware, validate(bulkUpdateStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { application_ids, status } = req.body;
    const talentId = req.talentId;

    // Single query to find all accessible application IDs
    const accessibleResult = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = ANY($1) AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [application_ids, talentId]);

    const accessibleIds = accessibleResult.rows.map(r => r.id);

    if (accessibleIds.length === 0) {
      return res.json({ success: true, updated: 0, failed: application_ids.length });
    }

    // Single update for all accessible applications
    const updateResult = await pool.query(
      'UPDATE opportunity_applications SET status = $1, updated_at = NOW() WHERE id = ANY($2)',
      [status, accessibleIds]
    );

    const updated = updateResult.rowCount || 0;
    const failed = application_ids.length - updated;

    res.json({ success: true, updated, failed });
  } catch (error) {
    console.error('Error bulk updating status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour en masse' });
  }
});

/**
 * DELETE /api/applications/:id/organization - Delete application (by organization)
 * Hard delete - allows organization to remove application
 * Requires: Auth (must be organization member)
 */
router.delete('/:id/organization', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Verify organization access
    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Hard delete - first delete related messages, then the application
    await pool.query('DELETE FROM application_messages WHERE application_id = $1', [id]);
    await pool.query('DELETE FROM opportunity_applications WHERE id = $1', [id]);

    res.json({ success: true, message: 'Candidature supprimée' });
  } catch (error) {
    console.error('Error deleting application (org):', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la candidature' });
  }
});

// ============================================================================
// MESSAGE ENDPOINTS
// ============================================================================

/**
 * GET /api/applications/:id/messages - Get messages for an application
 * Requires: Auth (applicant or organization member)
 */
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { limit = 50, offset = 0 } = req.query;

    // Check access: applicant or organization member
    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const result = await pool.query(`
      SELECT * FROM application_messages
      WHERE application_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `, [id, Number(limit), Number(offset)]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * POST /api/applications/:id/messages - Send a message
 * Requires: Auth (applicant or organization member)
 * NOTE: Organization must send the first message - talents cannot initiate conversation
 */
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { content, attachments, proposed_datetime, datetime_type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }

    // Check access and determine sender type
    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id,
        CASE WHEN a.talent_id = $2 THEN 'TALENT' ELSE 'ORGANIZATION' END as sender_type
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const senderType = accessCheck.rows[0].sender_type;

    // Enforce organization-sends-first-message rule
    if (senderType === 'TALENT') {
      const existingMessages = await pool.query(
        'SELECT id FROM application_messages WHERE application_id = $1 LIMIT 1',
        [id]
      );

      if (existingMessages.rows.length === 0) {
        return res.status(403).json({
          error: 'Vous ne pouvez pas initier la conversation. Veuillez attendre que l\'organisation vous contacte.',
          code: 'ORGANIZATION_FIRST_MESSAGE_REQUIRED'
        });
      }
    }

    const messageId = uuidv4();

    const result = await pool.query(`
      INSERT INTO application_messages (
        id, application_id, sender_type, sender_id, content, attachments,
        proposed_datetime, datetime_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      messageId,
      id,
      senderType,
      talentId,
      content.trim(),
      attachments ? JSON.stringify(attachments) : '[]',
      proposed_datetime || null,
      datetime_type || null
    ]);

    // Notify about new message
    pushService.notifyApplicationMessage(id, messageId, senderType)
      .catch(err => console.error('Notification error:', err));

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * PUT /api/applications/:id/messages/read-all - Mark all messages as read
 * Requires: Auth (applicant or organization member)
 */
router.put('/:id/messages/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check access
    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const isApplicant = accessCheck.rows[0].talent_id === talentId;
    const otherSenderType = isApplicant ? 'ORGANIZATION' : 'TALENT';

    // Mark messages from the other party as read
    const result = await pool.query(`
      UPDATE application_messages
      SET read_at = NOW()
      WHERE application_id = $1 AND sender_type = $2 AND read_at IS NULL
    `, [id, otherSenderType]);

    res.json({ success: true, marked: result.rowCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Erreur lors du marquage des messages' });
  }
});

/**
 * GET /api/applications/opportunity/:opportunityId/export-csv - Export candidatures to CSV
 * Exports all applications for an opportunity with talent info
 * Requires: Auth (must be organization member)
 */
router.get('/opportunity/:opportunityId/export-csv', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status, matchCategory } = req.query;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT o.id, o.title FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette opportunité' });
    }

    const opportunityTitle = accessCheck.rows[0].title;

    // Get ranked applications with talent info
    const rankedApplications = await rankApplications(opportunityId, status as string | undefined);

    // Filter by matchCategory if provided
    let filteredApps = rankedApplications;
    if (matchCategory) {
      filteredApps = rankedApplications.filter(app => app.matchCategory === matchCategory);
    }

    // Build CSV content
    const headers = [
      'Prénom',
      'Nom',
      'Email',
      'Téléphone',
      'Ville',
      'Poste actuel',
      'Années d\'expérience',
      'Compétences',
      'Match',
      'Score',
      'Statut',
      'Note (étoiles)',
      'Date de candidature',
      'CV'
    ];

    const STATUS_LABELS: Record<string, string> = {
      'SUBMITTED': 'Soumise',
      'IN_REVIEW': 'En examen',
      'ACCEPTED': 'Acceptée',
      'REJECTED': 'Refusée'
    };

    const MATCH_LABELS: Record<string, string> = {
      'excellent': 'Excellent',
      'good': 'Bon',
      'average': 'Moyen',
      'low': 'Faible'
    };

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredApps.map(app => {
      const talent = app.talent || {};
      return [
        escapeCSV(talent.first_name),
        escapeCSV(talent.last_name),
        escapeCSV(talent.email),
        escapeCSV(talent.phone),
        escapeCSV(talent.city),
        escapeCSV(talent.current_role),
        escapeCSV(talent.years_experience),
        escapeCSV(Array.isArray(talent.skills) ? talent.skills.join(', ') : ''),
        escapeCSV(MATCH_LABELS[app.matchCategory || ''] || ''),
        escapeCSV(app.matchScore ? Math.round(app.matchScore) : ''),
        escapeCSV(STATUS_LABELS[app.status] || app.status),
        escapeCSV(app.star_rating || ''),
        escapeCSV(app.applied_at ? new Date(app.applied_at).toLocaleDateString('fr-FR') : ''),
        escapeCSV(app.cv_url || '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Set response headers for CSV download
    const filename = `candidatures-${opportunityTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Add BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('Error exporting applications to CSV:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export CSV' });
  }
});

export default router;
