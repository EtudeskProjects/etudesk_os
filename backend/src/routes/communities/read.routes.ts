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
    const { type, status, include_private = 'false', search } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = (req as AuthRequest).talentId;

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
      sectors: userProfile?.sectors || [],
      query: (search as string) || undefined
    };

    // We need to inject the CASE WHEN clause into the select parts.
    // Since createQueryBuilder doesn't easily support arbitrary complex select expressions added later, 
    // it's safer to reconstruct the query or inject the variable if we were using a raw query builder. 
    // However, the current implementation uses a custom builder.
    // The MatchingUtils returns a string expression. We can add it to the select list.

    const matchScoreExpr = MatchingUtils.buildMatchScore('c', criteria);

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
        ) as organization,
        ${matchScoreExpr} as match_score
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

    if (search) {
      builder = addCondition(builder, "(c.name ILIKE ? OR c.description ILIKE ?)", [`%${search}%`, `%${search}%`]);
    }

    // builder = addOrderBy(builder, 'match_score', 'DESC'); // The utility might not support generated column alias in ORDER BY directly if it is strictly parsing fields
    // Assuming addOrderBy supports alias if SQL allows it (Postgres does allow alias in ORDER BY)

    // We manually append sorting to prioritize match_score
    // The custom builder utilities might enforce specific patterns. 
    // Let's rely on adding the order by manually if needed or standard way.

    builder = addOrderBy(builder, 'match_score', 'DESC');
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
 * GET /api/communities/:id/membership - Get current user's membership status for a community
 * Returns 200 with is_member / has_pending_request (never 404 for "not a member")
 */
router.get('/:id/membership', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = (req as AuthRequest).talentId;

    const communityResult = await pool.query(
      `SELECT id FROM communities WHERE (id::text = $1 OR slug = $1) AND deleted_at IS NULL`,
      [id]
    );
    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found', code: 'NOT_FOUND' });
    }
    const communityId = communityResult.rows[0].id;

    if (!talentId) {
      return res.json({
        data: { is_member: false, has_pending_request: false },
      });
    }

    const membershipResult = await pool.query(
      `SELECT id, role, status, joined_at, created_at
       FROM community_members
       WHERE community_id = $1 AND talent_id = $2`,
      [communityId, talentId]
    );
    const row = membershipResult.rows[0];
    if (!row) {
      return res.json({
        data: { is_member: false, has_pending_request: false },
      });
    }

    const is_member = row.status === 'ACTIVE' || row.status === null;
    const has_pending_request = row.status === 'PENDING';
    return res.json({
      data: {
        is_member,
        has_pending_request,
        membership_id: row.id,
        role: row.role,
        status: row.status,
        joined_at: row.joined_at,
      },
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching community membership');
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
      WHERE (c.id::text = $1 OR c.slug = $1) AND c.deleted_at IS NULL
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
