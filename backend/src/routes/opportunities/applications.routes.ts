/**
 * Opportunity Applications Routes
 * Application management for opportunities
 */

import { Router, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createForbiddenError,
} from '../../utils';

const router = Router();

/**
 * GET /api/opportunities/:id/applications - Get applications for an opportunity
 */
router.get('/:id/applications', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    // Check access
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:notAuthorizedOpportunity'));
    }

    let query = `
      SELECT
        a.*,
        t.id as talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_display_name,
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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    // Count by status
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

    // Transform to nested talent object
    const applications = result.rows.map(row => ({
      ...row,
      talent: {
        id: row.talent_id,
        display_name: row.talent_display_name,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        avatar_url: row.talent_avatar,
        profile_picture_url: row.talent_avatar,
        email: row.talent_email,
        city: row.talent_city,
        country: row.talent_country,
        bio: row.talent_bio,
        headline: row.talent_bio,
      },
    }));

    res.json({
      data: applications,
      count: result.rowCount,
      statusCounts
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching opportunity applications');
  }
});

/**
 * GET /api/opportunities/:id/applications/counts - Get application counts by status
 */
router.get('/:id/applications/counts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check access
    const accessCheck = await pool.query(`
      SELECT o.id FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
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
    handleRouteError(res, error, 'Error fetching application counts');
  }
});

export default router;
