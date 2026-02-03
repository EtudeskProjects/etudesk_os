/**
 * Community Members Routes
 * Member management operations
 */

import { Router, Response } from 'express';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  createPaginatedResponse,
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  logger,
} from '../../utils';

const router = Router();

/**
 * GET /api/communities/:id/members - Get community members
 */
router.get('/:id/members', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const pagination = getPaginationParams(req);
    const { status = 'ACTIVE', role } = req.query;

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM community_members
      WHERE community_id = $1 AND (status IS NULL OR status = $2)
    `;
    const countParams: (string | number)[] = [id, status as string];

    if (role) {
      countQuery += ` AND role = $3`;
      countParams.push(role as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get members with talent info
    let query = `
      SELECT cm.*,
        json_build_object(
          'id', t.id,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'email', t.email,
          'avatar_url', t.avatar_url,
          'slug', t.slug
        ) as talent
      FROM community_members cm
      JOIN talents t ON cm.talent_id = t.id
      WHERE cm.community_id = $1 AND (cm.status IS NULL OR cm.status = $2)
    `;
    const params: (string | number)[] = [id, status as string];
    let paramIndex = 3;

    if (role) {
      query += ` AND cm.role = $${paramIndex++}`;
      params.push(role as string);
    }

    query += ` ORDER BY cm.joined_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    handleRouteError(res, error, 'Error fetching community members');
  }
});

/**
 * GET /api/communities/:id/recent-members - Get recent members (preview)
 */
router.get('/:id/recent-members', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const result = await pool.query(`
      SELECT
        t.id,
        t.first_name,
        t.last_name,
        t.avatar_url,
        cm.joined_at
      FROM community_members cm
      JOIN talents t ON cm.talent_id = t.id
      WHERE cm.community_id = $1 AND (cm.status IS NULL OR cm.status = 'ACTIVE')
      ORDER BY cm.joined_at DESC
      LIMIT $2
    `, [id, Number(limit)]);

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching recent members');
  }
});

/**
 * POST /api/communities/:id/join - Join a community
 */
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { answers, accepted_rules = true } = req.body;

    // Check if community exists and get access type
    const communityResult = await pool.query(
      `SELECT id, access_type, application_questions FROM communities WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (communityResult.rows.length === 0) {
      throw createNotFoundError('Community');
    }

    const community = communityResult.rows[0];

    // Check if already a member
    const existingMember = await pool.query(
      `SELECT id, status FROM community_members WHERE community_id = $1 AND talent_id = $2`,
      [id, talentId]
    );

    if (existingMember.rows.length > 0) {
      const member = existingMember.rows[0];
      if (member.status === 'ACTIVE') {
        return res.status(400).json({ error: 'Already a member' });
      }
      if (member.status === 'PENDING') {
        return res.status(400).json({ error: 'Request already pending' });
      }
    }

    // Determine initial status based on access type
    const initialStatus = community.access_type === 'PUBLIC' ? 'ACTIVE' : 'PENDING';

    // Create or update membership
    const result = await pool.query(`
      INSERT INTO community_members (community_id, talent_id, role, status, answers, accepted_rules, joined_at)
      VALUES ($1, $2, 'MEMBER', $3, $4, $5, CURRENT_DATE)
      ON CONFLICT (community_id, talent_id)
      DO UPDATE SET status = $3, answers = $4, accepted_rules = $5, updated_at = NOW()
      RETURNING *
    `, [id, talentId, initialStatus, answers ? JSON.stringify(answers) : null, accepted_rules]);

    res.status(201).json({
      data: result.rows[0],
      message: initialStatus === 'ACTIVE' ? 'Joined successfully' : 'Request submitted',
    });
  } catch (error) {
    handleRouteError(res, error, 'Error joining community');
  }
});

/**
 * DELETE /api/communities/:id/leave - Leave a community
 */
router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check if user is admin and only admin
    const memberCheck = await pool.query(`
      SELECT role FROM community_members WHERE community_id = $1 AND talent_id = $2
    `, [id, talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Not a member' });
    }

    if (memberCheck.rows[0].role === 'ADMIN') {
      // Check if there are other admins
      const otherAdmins = await pool.query(`
        SELECT COUNT(*) as count FROM community_members
        WHERE community_id = $1 AND role = 'ADMIN' AND talent_id != $2 AND (status IS NULL OR status = 'ACTIVE')
      `, [id, talentId]);

      if (parseInt(otherAdmins.rows[0].count) === 0) {
        return res.status(400).json({
          error: 'Cannot leave: You are the only admin. Transfer ownership first.',
        });
      }
    }

    await pool.query(
      `UPDATE community_members SET status = 'ARCHIVED', left_at = CURRENT_DATE WHERE community_id = $1 AND talent_id = $2`,
      [id, talentId]
    );

    res.json({ success: true, message: 'Left community' });
  } catch (error) {
    handleRouteError(res, error, 'Error leaving community');
  }
});

/**
 * PUT /api/communities/:id/members/:memberId - Update member (admin only)
 */
router.put('/:id/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const talentId = req.talentId;
    const { role, status } = req.body;

    // Check admin permission
    const adminCheck = await pool.query(`
      SELECT 1 FROM community_members
      WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')
    `, [id, talentId]);

    if (adminCheck.rows.length === 0) {
      throw createForbiddenError('Only admins can update members');
    }

    const result = await pool.query(`
      UPDATE community_members SET
        role = COALESCE($1, role),
        status = COALESCE($2, status),
        updated_at = NOW()
      WHERE id = $3 AND community_id = $4
      RETURNING *
    `, [role, status, memberId, id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Member');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating member');
  }
});

/**
 * DELETE /api/communities/:id/members/:memberId - Remove member (admin only)
 */
router.delete('/:id/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const talentId = req.talentId;

    // Check admin permission
    const adminCheck = await pool.query(`
      SELECT 1 FROM community_members
      WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')
    `, [id, talentId]);

    if (adminCheck.rows.length === 0) {
      throw createForbiddenError('Only admins can remove members');
    }

    await pool.query(
      `UPDATE community_members SET status = 'ARCHIVED', left_at = CURRENT_DATE WHERE id = $1 AND community_id = $2`,
      [memberId, id]
    );

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    handleRouteError(res, error, 'Error removing member');
  }
});

export default router;
