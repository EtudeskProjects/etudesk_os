/**
 * Organizations Read Routes
 * GET operations for organizations
 */

import { Router, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
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
router.get('/', async (req, res) => {
  try {
    const { type, country } = req.query;
    const pagination = getPaginationParams(req);

    let query = `
      SELECT o.*,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
      FROM organizations o
      WHERE o.deleted_at IS NULL
    `;
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND $${paramIndex++} = ANY(o.types)`;
      params.push(type as string);
    }
    if (country) {
      query += ` AND o.headquarters_country = $${paramIndex++}`;
      params.push(country as string);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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
