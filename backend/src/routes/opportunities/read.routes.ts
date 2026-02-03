/**
 * Opportunities Read Routes
 * GET operations for opportunities
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../services/database';
import { optionalAuthMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createNotFoundError,
  logger,
} from '../../utils';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * GET /api/opportunities - List all opportunities
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, location_type } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    // Get user email for invitation check
    let userEmail: string | null = null;
    if (talentId) {
      const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
      if (userResult.rows.length > 0) {
        userEmail = userResult.rows[0].email;
      }
    }

    // Base query: only PUBLIC opportunities OR those where user is invited
    let query = `
      SELECT o.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', org.id,
            'name', org.name,
            'logo_url', org.logo_url,
            'types', org.types,
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
      AND (
        COALESCE(o.visibility, 'PUBLIC') = 'PUBLIC'
    `;

    const params: QueryParam[] = [];
    let paramIndex = 1;

    // If user is authenticated, also show opportunities they're invited to or own
    if (talentId && userEmail) {
      query += `
        OR EXISTS (
          SELECT 1 FROM opportunity_invitations oi
          WHERE oi.opportunity_id = o.id
          AND (oi.invitee_talent_id = $${paramIndex} OR LOWER(oi.invitee_email) = LOWER($${paramIndex + 1}))
        )
        OR EXISTS (
          SELECT 1 FROM opportunity_posters op2
          LEFT JOIN organization_members om ON op2.poster_organization_id = om.organization_id
          WHERE op2.opportunity_id = o.id
          AND (op2.poster_talent_id = $${paramIndex} OR om.talent_id = $${paramIndex})
        )
      `;
      params.push(talentId, userEmail);
      paramIndex += 2;
    }

    query += `)`;

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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching opportunities');
  }
});

/**
 * GET /api/opportunities/can-generate - Check if generation is possible
 */
router.get('/can-generate', (req: Request, res: Response) => {
  const { title, type } = req.query;
  const canGenerate = title && typeof title === 'string' && title.length >= 3 && type;
  res.json({ canGenerate: !!canGenerate });
});

/**
 * GET /api/opportunities/organization/:orgId - Get opportunities by organization
 */
router.get('/organization/:orgId', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status } = req.query;
    const pagination = getPaginationParams(req);

    // Build count query
    let countQuery = `
      SELECT COUNT(*) as total FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
    `;
    const countParams: QueryParam[] = [orgId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND o.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Build data query
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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: total });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization opportunities');
  }
});

/**
 * GET /api/opportunities/:id - Get single opportunity
 */
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
            'types', org.types,
            'headquarters_city', org.headquarters_city,
            'headquarters_country', org.headquarters_country,
            'verification_status', org.verification_status
          ))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations,
        '[]'::json as skills,
        (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count
      FROM opportunities o
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Opportunity');
    }

    const opportunity = result.rows[0];
    if (opportunity.sectors === null || opportunity.sectors === undefined) {
      opportunity.sectors = [];
    }

    res.json({ data: opportunity });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching opportunity');
  }
});

export default router;
