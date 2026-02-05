/**
 * Organizations Read Routes
 * GET operations for organizations
 */

import { Router, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createNotFoundError,
} from '../../utils';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * GET /api/organizations - List all organizations
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, country, search } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    // Get user profile for matching
    let userProfile: any = null;

    if (talentId) {
      const userResult = await pool.query(`
        SELECT id, email, city, region, country, remote_ready, willing_to_relocate,
          sectors, profile_tags, goals, bio
        FROM talents 
        WHERE id = $1
      `, [talentId]);

      if (userResult.rows.length > 0) {
        userProfile = userResult.rows[0];
      }
    }

    const { MatchingUtils } = await import('../../utils/MatchingUtils');
    // Build matching criteria
    const criteria = {
      city: userProfile?.city,
      region: userProfile?.region,
      country: userProfile?.country,
      remote: userProfile?.remote_ready,
      sectors: userProfile?.sectors || [],
      query: (search as string) || undefined
    };

    const matchScore = MatchingUtils.buildMatchScore('org', criteria);

    // Filter invisible organizations unless searching specifically or direct access?
    // User requirement: "si c'est false, le copilote ne peut que voir les talents et organsations is visible a true"
    // Assuming for general listing we also hide them.

    let query = `
      SELECT org.*,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = org.id) as member_count,
        ${matchScore} as match_score
      FROM organizations org
      WHERE org.deleted_at IS NULL
      AND org.is_visible = TRUE
    `;

    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND $${paramIndex++} = ANY(org.types)`;
      params.push(type as string);
    }
    if (country) {
      query += ` AND org.headquarters_country = $${paramIndex++}`;
      params.push(country as string);
    }

    if (search) {
      query += ` AND (org.name ILIKE $${paramIndex} OR org.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sort by Match Score, then Recency
    query += ` ORDER BY match_score DESC, org.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organizations');
  }
});

/**
 * GET /api/organizations/my - Get organizations where current user is a member
 */
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.json({ data: [] });
    }

    const result = await pool.query(`
      SELECT o.*,
        om.role as user_role,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
        o.headquarters_coordinates[0] as headquarters_longitude,
        o.headquarters_coordinates[1] as headquarters_latitude
      FROM organizations o
      INNER JOIN organization_members om ON om.organization_id = o.id AND om.talent_id = $1
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `, [req.talentId]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching my organizations');
  }
});

/**
 * GET /api/organizations/:id - Get a specific organization
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
        o.headquarters_coordinates[0] as headquarters_longitude,
        o.headquarters_coordinates[1] as headquarters_latitude
      FROM organizations o
      WHERE (o.id::text = $1 OR o.slug = $1) AND o.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Organization');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization');
  }
});

export default router;
