/**
 * Applications Organization Routes
 * Routes for recruiters/organizations managing applications
 */

import { Router, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  validate,
  updateApplicationStatusSchema,
  updateApplicationNotesSchema,
  updateApplicationRatingSchema,
  bulkUpdateStatusSchema,
  uuidParamSchema,
  opportunityIdParamSchema,
} from '../../middleware/validation.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createForbiddenError,
  logger,
} from '../../utils';
import { getLocaleForLanguage, normalizeLanguage } from '../../i18n';
import { rankApplications } from '../../services/matching.service';
import { debitWalletForAction } from '../../services/billing/credit.service';
import { getApplicationRecommendation } from '../../services/recommendation.service';
import * as notificationService from '../../services/notification.service';
import { validateFromOpportunity } from '../../services/skills/skill-validation.service';

const router = Router();

/**
 * GET /api/applications/opportunity/:opportunityId - Get applications for an opportunity
 */
router.get('/opportunity/:opportunityId', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:notAuthorizedOpportunity'));
    }

    let query = `
      SELECT
        a.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

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
    handleRouteError(res, error, 'Error fetching opportunity applications');
  }
});

/**
 * GET /api/applications/opportunity/:opportunityId/ranked - Get ranked applications
 */
router.get('/opportunity/:opportunityId/ranked', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status } = req.query;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT o.id, op.poster_organization_id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:notAuthorizedOpportunity'));
    }

    // Debit credits for application scoring
    const posterOrgId = accessCheck.rows[0].poster_organization_id;
    if (posterOrgId) {
      try {
        await debitWalletForAction({
          scope: 'ORGANIZATION',
          ownerId: posterOrgId,
          actionCode: 'ORG_APPLICATION_SCORING',
          idempotencyKey: `app_scoring_${posterOrgId}_${opportunityId}_${Date.now()}`,
          metadata: { opportunityId, status: status || 'all' },
          createdBy: talentId,
        });
      } catch (debitError: any) {
        if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
          return res.status(402).json({
            error: req.t('billing:insufficientCredits'),
            code: 'INSUFFICIENT_CREDITS',
          });
        }
        throw debitError;
      }
    }

    const rankedApplications = await rankApplications(opportunityId, status as string | undefined);

    const grouped: Record<string, typeof rankedApplications> = {};
    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'];

    for (const app of rankedApplications) {
      const appStatus = app.status || 'SUBMITTED';
      if (!grouped[appStatus]) {
        grouped[appStatus] = [];
      }
      grouped[appStatus].push(app);
    }

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
    handleRouteError(res, error, 'Error fetching ranked applications');
  }
});

/**
 * GET /api/applications/opportunity/:opportunityId/export-csv - Export to CSV
 */
router.get('/opportunity/:opportunityId/export-csv', authMiddleware, validate(opportunityIdParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { status, matchCategory } = req.query;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT o.id, o.title FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:notAuthorizedOpportunity'));
    }

    const opportunityTitle = accessCheck.rows[0].title;

    const rankedApplications = await rankApplications(opportunityId, status as string | undefined);
    let filteredApps = rankedApplications;
    if (matchCategory) {
      filteredApps = rankedApplications.filter(app => app.matchCategory === matchCategory);
    }

    const headers = [
      'Prénom',
      'Nom',
      'Email',
      'Téléphone',
      'Ville',
      'Poste actuel',
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

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let userLanguage = normalizeLanguage('en');
    if (req.userId) {
      const userLanguageResult = await pool.query(
        'SELECT preferred_language FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [req.userId]
      );
      userLanguage = normalizeLanguage(userLanguageResult.rows[0]?.preferred_language);
    }

    const locale = getLocaleForLanguage(userLanguage);

    const rows = filteredApps.map(app => {
      const talent = app.talent || {};
      return [
        escapeCSV(talent.first_name),
        escapeCSV(talent.last_name),
        escapeCSV(talent.email),
        escapeCSV(talent.phone),
        escapeCSV(talent.city),
        escapeCSV(talent.current_role),
        escapeCSV(Array.isArray(talent.skills) ? talent.skills.join(', ') : ''),
        escapeCSV(MATCH_LABELS[app.matchCategory || ''] || ''),
        escapeCSV(app.matchScore ? Math.round(app.matchScore) : ''),
        escapeCSV(STATUS_LABELS[app.status] || app.status),
        escapeCSV(app.star_rating || ''),
        escapeCSV(app.applied_at ? new Date(app.applied_at).toLocaleDateString(locale) : ''),
        escapeCSV(app.cv_url || '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `candidatures-${opportunityTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    handleRouteError(res, error, 'Error exporting applications to CSV');
  }
});

/**
 * GET /api/applications/:id/recommendation - Get AI recommendation
 */
router.get('/:id/recommendation', authMiddleware, validate(uuidParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const recommendation = await getApplicationRecommendation(id);

    if (!recommendation) {
      return res.status(404).json({ error: req.t('applications:unableToGenerateRecommendation') });
    }

    res.json({
      success: true,
      data: {
        application_id: id,
        recommendation
      }
    });
  } catch (error) {
    handleRouteError(res, error, 'Error getting recommendation');
  }
});

/**
 * PUT /api/applications/:id/status - Update application status
 */
router.put('/:id/status', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:notAuthorized'));
    }

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

    if (oldStatus && oldStatus !== status) {
      notificationService.notifyApplicationStatusChanged(id, oldStatus, status)
        .catch(err => logger.error('Notification error:', err));
    }

    // Participation validation: being accepted to an opportunity validates the
    // catalog skills linked to that opportunity (fire-and-forget, best-effort).
    if (status === 'ACCEPTED' && oldStatus !== 'ACCEPTED') {
      const app = result.rows[0];
      validateFromOpportunity(app.talent_id, app.opportunity_id)
        .catch(err => logger.error('Skill validation error:', err));
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: req.t('applications:statusUpdated')
    });
  } catch (error) {
    handleRouteError(res, error, 'Error updating application status');
  }
});

/**
 * PUT /api/applications/:id/notes - Update internal notes
 */
router.put('/:id/notes', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationNotesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET internal_notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [notes, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating notes');
  }
});

/**
 * PUT /api/applications/:id/rating - Rate an application
 */
router.put('/:id/rating', authMiddleware, validate(uuidParamSchema, 'params'), validate(updateApplicationRatingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET star_rating = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [rating, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating rating');
  }
});

/**
 * PUT /api/applications/:id/view - Mark as viewed
 */
router.put('/:id/view', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const result = await pool.query(`
      UPDATE opportunity_applications
      SET viewed_at = COALESCE(viewed_at, NOW()), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error marking as viewed');
  }
});

/**
 * PUT /api/applications/bulk/status - Bulk status update
 */
router.put('/bulk/status', authMiddleware, validate(bulkUpdateStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { application_ids, status } = req.body;
    const talentId = req.talentId;

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
      return res.json({ success: true, updated: 0, failed: application_ids.length, data: { updated: 0, failed: application_ids.length } });
    }

    const updateResult = await pool.query(
      'UPDATE opportunity_applications SET status = $1, updated_at = NOW() WHERE id = ANY($2)',
      [status, accessibleIds]
    );

    const updated = updateResult.rowCount || 0;
    const failed = application_ids.length - updated;

    res.json({ success: true, updated, failed, data: { updated, failed } });
  } catch (error) {
    handleRouteError(res, error, 'Error bulk updating status');
  }
});

/**
 * DELETE /api/applications/:id/organization - Delete application (by organization)
 */
router.delete('/:id/organization', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    await pool.query('DELETE FROM application_messages WHERE application_id = $1', [id]);
    await pool.query('DELETE FROM opportunity_applications WHERE id = $1', [id]);

    res.json({ success: true, message: req.t('applications:deleted'), data: { success: true, message: req.t('applications:deleted') } });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting application (org)');
  }
});

export default router;
