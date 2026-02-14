/**
 * Spaces Read Routes
 * GET operations for spaces
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../services/database';
import { optionalAuthMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  logger,
} from '../../utils';
import { SpaceFilters } from '../../types/space.types';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * GET /api/spaces - List spaces with filters
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      organization_id,
      type,
      city,
      country,
      min_capacity,
      max_capacity,
      is_bookable,
      is_accessible,
    } = req.query as unknown as SpaceFilters;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    // Check if visibility column exists
    let hasVisibilityColumn = false;
    try {
      const columnCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'spaces' AND column_name = 'visibility'`
      );
      hasVisibilityColumn = columnCheck.rows.length > 0;
    } catch (checkError) {
      logger.warn('Failed to check visibility column', { error: String(checkError) });
    }

    // Check if space_invitations table exists
    let hasSpaceInvitationsTable = false;
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_name = 'space_invitations'`
      );
      hasSpaceInvitationsTable = tableCheck.rows.length > 0;
    } catch (checkError) {
      logger.warn('Failed to check space_invitations table', { error: String(checkError) });
    }

    // Get user profile for matching
    let userProfile: any = null;
    let userEmail: string | null = null;

    if (talentId) {
      try {
        const userResult = await pool.query(`
          SELECT id, email, city, region, country, remote_ready, willing_to_relocate,
            sectors, profile_tags, goals, bio
          FROM talents 
          WHERE id = $1
        `, [talentId]);

        if (userResult.rows.length > 0) {
          userProfile = userResult.rows[0];
          userEmail = userProfile.email;
        }
      } catch (emailError) {
        logger.warn('Failed to fetch user email for invitation check', { error: String(emailError) });
      }
    }

    const { MatchingUtils } = await import('../../utils/MatchingUtils');
    // Build matching criteria
    const criteria = {
      city: userProfile?.city,
      region: userProfile?.region,
      country: userProfile?.country,
      sectors: userProfile?.sectors || [],
    };

    const matchFragment = MatchingUtils.buildMatchScore('s', criteria);

    // Base query: only PUBLIC spaces OR those where user is invited
    let query = `
      SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        (SELECT COUNT(*) FROM space_bookings sb
         WHERE sb.space_id = s.id AND sb.status = 'CONFIRMED'
         AND sb.end_datetime > NOW()) as active_bookings_count,
        ${matchFragment.sql} as match_score
      FROM spaces s
      LEFT JOIN organizations o ON s.organization_id = o.id
      WHERE s.deleted_at IS NULL AND s.status = 'ACTIVE'
      AND (
        ${hasVisibilityColumn
        ? `COALESCE(s.visibility, 'PUBLIC') = 'PUBLIC'`
        : `TRUE`}
    `;

    const params: QueryParam[] = [...matchFragment.params as QueryParam[]];
    let paramIndex = matchFragment.params.length + 1;

    // If user is authenticated, also show spaces they're invited to or own
    if (talentId) {
      const authClauses: string[] = [];

      if (hasSpaceInvitationsTable && userEmail) {
        authClauses.push(`
          EXISTS (
            SELECT 1 FROM space_invitations si
            WHERE si.space_id = s.id
            AND (si.invitee_talent_id = $${paramIndex} OR LOWER(si.invitee_email) = LOWER($${paramIndex + 1}))
          )
        `);
        params.push(talentId, userEmail);
        paramIndex += 2;
      }

      authClauses.push(`
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = s.organization_id
          AND om.talent_id = $${paramIndex}
        )
      `);
      params.push(talentId);
      paramIndex += 1;

      if (authClauses.length > 0) {
        query += ` OR ${authClauses.join(' OR ')}`;
      }
    }

    query += `)`;  // Close the visibility OR block

    if (organization_id) {
      query += ` AND s.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (type) {
      query += ` AND s.type = $${paramIndex++}`;
      params.push(type);
    }
    if (city) {
      query += ` AND s.city = $${paramIndex++}`;
      params.push(city);
    }
    if (country) {
      query += ` AND s.country = $${paramIndex++}`;
      params.push(country);
    }
    if (min_capacity) {
      query += ` AND s.capacity >= $${paramIndex++}`;
      params.push(Number(min_capacity));
    }
    if (max_capacity) {
      query += ` AND s.capacity <= $${paramIndex++}`;
      params.push(Number(max_capacity));
    }
    if (is_bookable !== undefined) {
      query += ` AND s.is_bookable = $${paramIndex++}`;
      params.push(String(is_bookable) === 'true');
    }
    if (is_accessible !== undefined) {
      query += ` AND s.is_accessible = $${paramIndex++}`;
      params.push(String(is_accessible) === 'true');
    }

    // Sort by Match Score, then Recency
    query += ` ORDER BY match_score DESC, s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    // Format response
    const spaces = result.rows.map((row) => ({
      ...row,
      organization: row.organization_name
        ? {
          id: row.organization_id,
          name: row.organization_name,
          logo_url: row.organization_logo,
        }
        : undefined,
    }));

    res.json({ data: spaces, count: result.rowCount });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching spaces');
  }
});

/**
 * GET /api/spaces/organization/:orgId - Get spaces by organization
 */
router.get('/organization/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const pagination = getPaginationParams(req);
    const { include_inactive } = req.query;

    let statusFilter = `AND s.status = 'ACTIVE'`;
    if (include_inactive === 'true') {
      statusFilter = '';
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM spaces s
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL ${statusFilter}`,
      [orgId]
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `
      SELECT s.*,
        (SELECT COUNT(*) FROM space_bookings sb
         WHERE sb.space_id = s.id AND sb.status = 'CONFIRMED'
         AND sb.end_datetime > NOW()) as active_bookings_count,
        (SELECT json_agg(sa.*) FROM space_availabilities sa
         WHERE sa.space_id = s.id AND sa.is_active = true) as availabilities
      FROM spaces s
      WHERE s.organization_id = $1 AND s.deleted_at IS NULL ${statusFilter}
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [orgId, pagination.limit, pagination.offset]
    );

    res.json({ data: result.rows, count: total });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization spaces');
  }
});

/**
 * GET /api/spaces/slug/:slug - Get space by slug
 */
router.get('/slug/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT * FROM spaces WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('spaces:notFound') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching space by slug');
  }
});

/**
 * GET /api/spaces/:id - Get single space with availabilities
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        o.headquarters_city as organization_city,
        (SELECT json_agg(sa.* ORDER BY sa.day_of_week, sa.start_time)
         FROM space_availabilities sa
         WHERE sa.space_id = s.id AND sa.is_active = true) as availabilities
      FROM spaces s
      LEFT JOIN organizations o ON s.organization_id = o.id
      WHERE (s.id::text = $1 OR s.slug = $1) AND s.deleted_at IS NULL
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('spaces:notFound') });
    }

    const space = result.rows[0];
    res.json({
      data: {
        ...space,
        organization: space.organization_name
          ? {
            id: space.organization_id,
            name: space.organization_name,
            logo_url: space.organization_logo,
            city: space.organization_city,
          }
          : undefined,
      },
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching space');
  }
});

/**
 * GET /api/spaces/:id/availabilities - Get space availabilities
 */
router.get('/:id/availabilities', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const spaceCheck = await pool.query(
      `SELECT id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (spaceCheck.rows.length === 0) {
      return res.status(404).json({ error: req.t('spaces:notFound') });
    }

    const result = await pool.query(
      `SELECT * FROM space_availabilities
       WHERE space_id = $1 AND is_active = true
       ORDER BY day_of_week, start_time`,
      [id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching availabilities');
  }
});

/**
 * GET /api/spaces/:id/availability-check - Check if slot is available
 */
router.get('/:id/availability-check', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { start_datetime, end_datetime } = req.query;

    if (!start_datetime || !end_datetime) {
      return res.status(400).json({ error: req.t('spaces:startEndDatetimeRequired') });
    }

    // Check for conflicting bookings
    const conflicts = await pool.query(
      `
      SELECT id, start_datetime, end_datetime
      FROM space_bookings
      WHERE space_id = $1
        AND status IN ('PENDING', 'CONFIRMED')
        AND (
          (start_datetime <= $2 AND end_datetime > $2) OR
          (start_datetime < $3 AND end_datetime >= $3) OR
          (start_datetime >= $2 AND end_datetime <= $3)
        )
    `,
      [id, start_datetime, end_datetime]
    );

    // Check for unavailability blocks
    const unavailable = await pool.query(
      `
      SELECT id, start_datetime, end_datetime, reason
      FROM space_unavailabilities
      WHERE space_id = $1
        AND (
          (start_datetime <= $2 AND end_datetime > $2) OR
          (start_datetime < $3 AND end_datetime >= $3) OR
          (start_datetime >= $2 AND end_datetime <= $3)
        )
    `,
      [id, start_datetime, end_datetime]
    );

    const isAvailable = conflicts.rows.length === 0 && unavailable.rows.length === 0;

    res.json({
      data: {
        is_available: isAvailable,
        conflicts: conflicts.rows,
        unavailabilities: unavailable.rows,
      },
    });
  } catch (error) {
    handleRouteError(res, error, 'Error checking availability');
  }
});

/**
 * GET /api/spaces/:spaceId/bookings/counts - Get booking counts by status
 */
router.get('/:spaceId/bookings/counts', async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;

    const result = await pool.query(
      `SELECT status, COUNT(*) as count FROM space_bookings WHERE space_id = $1 GROUP BY status`,
      [spaceId]
    );

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of result.rows) {
      const count = parseInt(row.count);
      byStatus[row.status] = count;
      total += count;
    }

    res.json({ data: { total, byStatus } });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching booking counts');
  }
});

export default router;
