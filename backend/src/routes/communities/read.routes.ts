/**
 * Communities Read Routes
 * GET operations for communities
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  createPaginatedResponse,
  handleRouteError,
  createQueryBuilder,
  addCondition,
  addPagination,
  addOrderBy,
  finalizeQuery,
  logger,
} from '../../utils';

const router = Router();

/**
 * GET /api/communities - List all communities (public only by default)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, include_private = 'false' } = req.query;
    const pagination = getPaginationParams(req);

    // Build query
    let builder = createQueryBuilder(`
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND (status IS NULL OR status = 'ACTIVE')) as members_count,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug,
          'logo_url', o.logo_url,
          'verification_status', o.verification_status
        ) as organization
      FROM communities c
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE c.deleted_at IS NULL
    `);

    // Filter visibility
    if (include_private !== 'true') {
      builder = addCondition(builder, "c.visibility = ?", 'PUBLIC');
      builder = addCondition(builder, "c.status = ?", 'ACTIVE');
    } else if (status) {
      builder = addCondition(builder, "c.status = ?", status as string);
    }

    if (type) {
      builder = addCondition(builder, "c.type = ?", type as string);
    }

    builder = addOrderBy(builder, 'c.created_at', 'DESC');
    builder = addPagination(builder, pagination.limit, pagination.offset);

    const { sql, params } = finalizeQuery(builder);
    const result = await pool.query(sql, params);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching communities');
  }
});

/**
 * GET /api/communities/organization/:orgId - Get communities by organization
 */
router.get('/organization/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const pagination = getPaginationParams(req);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM communities WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get communities
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND (status IS NULL OR status = 'ACTIVE')) as members_count
      FROM communities c
      WHERE c.organization_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [orgId, pagination.limit, pagination.offset]);

    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization communities');
  }
});

/**
 * GET /api/communities/:id - Get community by ID
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = (req as AuthRequest).talentId;

    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND (status IS NULL OR status = 'ACTIVE')) as members_count,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug,
          'logo_url', o.logo_url,
          'verification_status', o.verification_status
        ) as organization
      FROM communities c
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE (c.id = $1 OR c.slug = $1) AND c.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = result.rows[0];

    // Check membership if user is authenticated
    if (talentId) {
      const membershipResult = await pool.query(`
        SELECT role, status FROM community_members
        WHERE community_id = $1 AND talent_id = $2
      `, [community.id, talentId]);

      community.membership = membershipResult.rows[0] || null;
    }

    res.json({ data: community });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching community');
  }
});

/**
 * GET /api/communities/:id/stats - Get community statistics
 */
router.get('/:id/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND (status IS NULL OR status = 'ACTIVE')) as members_count,
        (SELECT COUNT(*) FROM community_activities WHERE community_id = $1 AND deleted_at IS NULL) as activities_count,
        (SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND status = 'PENDING') as pending_count
    `, [id]);

    res.json({ data: stats.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching community stats');
  }
});

export default router;
