/**
 * Community Members Routes
 * Member management operations
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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
import { communityPermissionService } from '../../services/community-permission.service';
import { validateFromCommunity } from '../../services/skills/skill-validation.service';

const router = Router();


/**
 * GET /api/communities/memberships/me - Get my memberships
 */
router.get('/memberships/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const pagination = getPaginationParams(req);
    const { status } = req.query;

    let query = `
      SELECT cm.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'cover_image_url', c.cover_image_url,
          'images', c.images,
          'members_count', (
            SELECT COUNT(*)::int
            FROM community_members cm2
            WHERE cm2.community_id = c.id
              AND (cm2.status IS NULL OR cm2.status = 'ACTIVE')
          ),
          'type', c.type,
          'visibility', c.visibility,
          'organization', (
             SELECT json_build_object('id', o.id, 'name', o.name)
             FROM organizations o WHERE o.id = c.organization_id
          )
        ) as community
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.talent_id = $1 AND c.deleted_at IS NULL
    `;
    const params: (string | number)[] = [talentId];
    let paramIndex = 2;

    if (status) {
      query += ` AND cm.status = $${paramIndex++}`;
      params.push(status as string);
    }

    // Get total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM community_members cm 
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.talent_id = $1 AND c.deleted_at IS NULL
      ${status ? `AND cm.status = $2` : ''}
    `;
    const countResult = await pool.query(countQuery, status ? [talentId, status] : [talentId]);
    const total = parseInt(countResult.rows[0].total);

    query += ` ORDER BY cm.joined_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    res.json(createPaginatedResponse(result.rows, total, pagination));
  } catch (error) {
    handleRouteError(res, error, 'Error fetching my memberships');
  }
});

/**
 * Check access to a membership: talent (owner of membership) or org admin of the community
 */
async function checkMembershipMessageAccess(membershipId: string, talentId: string): Promise<{ membership: any; senderType: 'TALENT' | 'ORGANIZATION' } | null> {
  const membershipResult = await pool.query(
    `SELECT cm.id, cm.talent_id, cm.community_id
     FROM community_members cm
     WHERE cm.id = $1`,
    [membershipId]
  );
  if (membershipResult.rows.length === 0) return null;
  const m = membershipResult.rows[0];
  if (m.talent_id === talentId) {
    return { membership: m, senderType: 'TALENT' };
  }
  const adminCheck = await pool.query(
    `SELECT 1 FROM community_members cm
     WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.role = 'ADMIN' AND (cm.status IS NULL OR cm.status = 'ACTIVE')`,
    [m.community_id, talentId]
  );
  if (adminCheck.rows.length > 0) {
    return { membership: m, senderType: 'ORGANIZATION' };
  }
  return null;
}

/**
 * GET /api/communities/members/:memberId/messages - Get messages for a membership
 */
router.get('/members/:memberId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;
    const pagination = getPaginationParams(req);

    const access = await checkMembershipMessageAccess(memberId, talentId);
    if (!access) {
      throw createNotFoundError('Membership');
    }

    const result = await pool.query(
      `SELECT id, membership_id, sender_type, sender_id, content, attachments,
              proposed_datetime, datetime_type, read_at, created_at, updated_at
       FROM community_membership_messages
       WHERE membership_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [memberId, pagination.limit, pagination.offset]
    );

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching membership messages');
  }
});

/**
 * POST /api/communities/members/:memberId/messages - Send a message
 */
router.post('/members/:memberId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;
    const { content, attachments, proposed_datetime, datetime_type } = req.body;

    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ error: req.t('communities:messageCannotBeEmpty') });
    }

    const access = await checkMembershipMessageAccess(memberId, talentId);
    if (!access) {
      throw createNotFoundError('Membership');
    }

    const messageId = uuidv4();
    await pool.query(
      `INSERT INTO community_membership_messages (
        id, membership_id, sender_type, sender_id, content, attachments,
        proposed_datetime, datetime_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        messageId,
        memberId,
        access.senderType,
        talentId,
        String(content).trim(),
        attachments ? JSON.stringify(attachments) : '[]',
        proposed_datetime || null,
        datetime_type || null,
      ]
    );

    const row = await pool.query(
      `SELECT * FROM community_membership_messages WHERE id = $1`,
      [messageId]
    );
    res.status(201).json({ data: row.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error sending membership message');
  }
});

/**
 * PUT /api/communities/members/:memberId/messages/read-all - Mark all messages as read
 */
router.put('/members/:memberId/messages/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;

    const access = await checkMembershipMessageAccess(memberId, talentId);
    if (!access) {
      throw createNotFoundError('Membership');
    }

    const otherSenderType = access.senderType === 'TALENT' ? 'ORGANIZATION' : 'TALENT';
    const result = await pool.query(
      `UPDATE community_membership_messages
       SET read_at = NOW()
       WHERE membership_id = $1 AND sender_type = $2 AND read_at IS NULL`,
      [memberId, otherSenderType]
    );

    res.json({ success: true, marked: result.rowCount ?? 0 });
  } catch (error) {
    handleRouteError(res, error, 'Error marking membership messages as read');
  }
});

/**
 * GET /api/communities/members/:memberId - Get a single membership by ID (talent or org admin)
 */
router.get('/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;

    const result = await pool.query(
      `SELECT cm.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'cover_image_url', c.cover_image_url,
          'application_questions', c.application_questions,
          'rules', c.rules
        ) as community,
        json_build_object(
          'id', t.id,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'email', t.email,
          'phone', t.phone,
          'avatar_url', t.avatar_url,
          'slug', t.slug,
          'city', t.city,
          'country', t.country,
          'bio', t.bio
        ) as talent
       FROM community_members cm
       JOIN communities c ON cm.community_id = c.id
       JOIN talents t ON cm.talent_id = t.id
       WHERE cm.id = $1 AND c.deleted_at IS NULL`,
      [memberId]
    );

    if (result.rows.length === 0) {
      throw createNotFoundError('Member');
    }

    const row = result.rows[0];
    const isTalentOwner = row.talent_id === talentId;
    const isOrgAdmin = !isTalentOwner && (await pool.query(
      `SELECT 1 FROM community_members
       WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')`,
      [row.community_id, talentId]
    )).rows.length > 0;

    if (!isTalentOwner && !isOrgAdmin) {
      throw createForbiddenError(req.t('communities:accessNotAuthorizedToMembership'));
    }

    const talent = row.talent as any;
    if (talent && (talent.first_name || talent.last_name)) {
      talent.display_name = [talent.first_name, talent.last_name].filter(Boolean).join(' ').trim() || talent.email;
    }

    res.json({ data: row });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching membership details');
  }
});

/**
 * GET /api/communities/members/:memberId/permissions - Get member permissions (org admin only)
 */
router.get('/members/:memberId/permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;

    const membershipResult = await pool.query(
      'SELECT community_id FROM community_members WHERE id = $1',
      [memberId]
    );
    if (membershipResult.rows.length === 0) {
      throw createNotFoundError('Member');
    }
    const communityId = membershipResult.rows[0].community_id;

    const adminCheck = await pool.query(
      `SELECT 1 FROM community_members
       WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')`,
      [communityId, talentId]
    );
    if (adminCheck.rows.length === 0) {
      throw createForbiddenError(req.t('communities:onlyAdminsCanViewPermissions'));
    }

    const data = await communityPermissionService.getMembershipPermissions(memberId);
    res.json({ data });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching member permissions');
  }
});

/**
 * PUT /api/communities/members/:memberId/permissions - Update member permissions (org admin only)
 */
router.put('/members/:memberId/permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;
    const { permissions } = req.body;

    const membershipResult = await pool.query(
      'SELECT community_id FROM community_members WHERE id = $1',
      [memberId]
    );
    if (membershipResult.rows.length === 0) {
      throw createNotFoundError('Member');
    }
    const communityId = membershipResult.rows[0].community_id;

    const adminCheck = await pool.query(
      `SELECT 1 FROM community_members
       WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')`,
      [communityId, talentId]
    );
    if (adminCheck.rows.length === 0) {
      throw createForbiddenError(req.t('communities:onlyAdminsCanUpdatePermissions'));
    }

    const updated = await communityPermissionService.updateMemberPermissions(memberId, permissions ?? null);
    const data = await communityPermissionService.getMembershipPermissions(memberId);
    res.json({
      data: {
        permissions: updated,
        isCustom: data.isCustom,
        message: permissions === null ? req.t('communities:permissionsResetToDefault') : req.t('communities:permissionsUpdated'),
      },
    });
  } catch (error) {
    handleRouteError(res, error, 'Error updating member permissions');
  }
});

/**
 * Helper: check if current user is org admin for a membership's community
 */
async function requireMembershipAdmin(memberId: string, talentId: string): Promise<string> {
  const membershipResult = await pool.query(
    'SELECT community_id FROM community_members WHERE id = $1',
    [memberId]
  );
  if (membershipResult.rows.length === 0) {
    throw createNotFoundError('Member');
  }
  const communityId = membershipResult.rows[0].community_id;
  const adminCheck = await pool.query(
    `SELECT 1 FROM community_members
     WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')`,
    [communityId, talentId]
  );
  if (adminCheck.rows.length === 0) {
    throw createForbiddenError('Only community admins can perform this action'); // Used in helper function without req
  }
  return communityId;
}

/**
 * PUT /api/communities/members/:memberId/rating - Update member rating (org admin only)
 */
router.put('/members/:memberId/rating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;
    const { rating } = req.body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: req.t('communities:ratingMustBeBetween1And5') });
    }

    await requireMembershipAdmin(memberId, talentId);

    const result = await pool.query(
      `UPDATE community_members SET star_rating = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [Math.round(rating), memberId]
    );
    if (result.rows.length === 0) {
      throw createNotFoundError('Member');
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating member rating');
  }
});

/**
 * PUT /api/communities/members/:memberId/notes - Update member internal notes (org admin only)
 */
router.put('/members/:memberId/notes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.params;
    const talentId = req.talentId!;
    const { notes } = req.body;

    await requireMembershipAdmin(memberId, talentId);

    const result = await pool.query(
      `UPDATE community_members SET internal_notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [notes == null ? null : String(notes), memberId]
    );
    if (result.rows.length === 0) {
      throw createNotFoundError('Member');
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating member notes');
  }
});

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

    // Get members with talent info (including city, country, bio for preview)
    let query = `
      SELECT cm.*,
        json_build_object(
          'id', t.id,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'email', t.email,
          'avatar_url', t.avatar_url,
          'slug', t.slug,
          'city', t.city,
          'country', t.country,
          'bio', t.bio
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
        return res.status(400).json({ error: req.t('communities:alreadyMemberError') });
      }
      if (member.status === 'PENDING') {
        return res.status(400).json({ error: req.t('communities:requestAlreadyPending') });
      }
    }

    // Toujours exiger la validation par l'organisation : nouvelle adhésion en PENDING
    const initialStatus = 'PENDING';

    // Create or update membership
    const result = await pool.query(`
      INSERT INTO community_members (community_id, talent_id, role, status, answers, accepted_rules, joined_at)
      VALUES ($1, $2, 'MEMBER', $3, $4, $5, NULL)
      ON CONFLICT (community_id, talent_id)
      DO UPDATE SET status = $3, answers = $4, accepted_rules = $5, joined_at = NULL, updated_at = NOW()
      RETURNING *
    `, [id, talentId, initialStatus, answers ? JSON.stringify(answers) : null, accepted_rules]);

    res.status(201).json({
      data: result.rows[0],
      message: req.t('communities:membershipRequestSent'),
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
      return res.status(400).json({ error: req.t('communities:notMember') });
    }

    if (memberCheck.rows[0].role === 'ADMIN') {
      // Check if there are other admins
      const otherAdmins = await pool.query(`
        SELECT COUNT(*) as count FROM community_members
        WHERE community_id = $1 AND role = 'ADMIN' AND talent_id != $2 AND (status IS NULL OR status = 'ACTIVE')
      `, [id, talentId]);

      if (parseInt(otherAdmins.rows[0].count) === 0) {
        return res.status(400).json({
          error: req.t('communities:cannotLeaveOnlyAdmin'),
        });
      }
    }

    await pool.query(
      `UPDATE community_members SET status = 'ARCHIVED', left_at = CURRENT_DATE WHERE community_id = $1 AND talent_id = $2`,
      [id, talentId]
    );

    res.json({ success: true, message: req.t('communities:leftCommunity') });
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
      throw createForbiddenError(req.t('communities:onlyAdminsCanPerformAction'));
    }

    const result = await pool.query(`
      UPDATE community_members SET
        role = COALESCE($1, role),
        status = COALESCE($2, status),
        joined_at = CASE WHEN $2 = 'ACTIVE' AND joined_at IS NULL THEN CURRENT_DATE ELSE joined_at END,
        updated_at = NOW()
      WHERE id = $3 AND community_id = $4
      RETURNING *
    `, [role, status, memberId, id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Member');
    }

    // Participation validation: an approved (ACTIVE) member gets the community's
    // linked soft skills validated (fire-and-forget, best-effort).
    if (status === 'ACTIVE') {
      const m = result.rows[0];
      validateFromCommunity(m.talent_id, m.community_id)
        .catch((err) => logger.error('Skill validation error:', err));
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
      throw createForbiddenError(req.t('communities:onlyAdminsCanPerformAction'));
    }

    await pool.query(
      `UPDATE community_members SET status = 'ARCHIVED', left_at = CURRENT_DATE WHERE id = $1 AND community_id = $2`,
      [memberId, id]
    );

    res.json({ success: true, message: req.t('communities:memberRemoved') });
  } catch (error) {
    handleRouteError(res, error, 'Error removing member');
  }
});

export default router;
