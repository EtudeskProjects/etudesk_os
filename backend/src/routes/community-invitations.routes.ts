/**
 * Community Invitations Routes
 * Handles sending, accepting, declining invitations for community membership
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { sendCommunityInviteEmail } from '../services/email.service';

import { logger } from '../utils';
const router = Router();

// ============================================================================
// INVITATION MANAGEMENT (for community admins)
// ============================================================================

/**
 * POST /api/communities/:communityId/invitations - Send invitation(s)
 * Body: { invitations: [{ email, name?, message?, role? }] }
 */
router.post('/:communityId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const talentId = req.talentId;
    const { invitations } = req.body;

    if (!talentId) {
      return res.status(401).json({ error: req.t('communities:notAuthenticated') });
    }

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({ error: req.t('communities:atLeastOneInvitationRequired') });
    }

    if (invitations.length > 50) {
      return res.status(400).json({ error: req.t('communities:maxInvitationsExceeded') });
    }

    // Verify user is admin of the community
    const accessCheck = await pool.query(`
      SELECT cm.role, c.name as community_name, c.organization_id
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.status = 'ACTIVE'
      AND cm.role = 'ADMIN'
    `, [communityId, talentId]);

    if (accessCheck.rows.length === 0) {
      // Also check if user is org member
      const orgCheck = await pool.query(`
        SELECT c.name as community_name
        FROM communities c
        JOIN organization_members om ON c.organization_id = om.organization_id
        WHERE c.id = $1 AND om.talent_id = $2
      `, [communityId, talentId]);

      if (orgCheck.rows.length === 0) {
        return res.status(403).json({ error: req.t('communities:noPermissionToInvite') });
      }
    }

    const communityName = accessCheck.rows[0]?.community_name || 'la communauté';
    const results: any[] = [];
    const errors: any[] = [];

    for (const invitation of invitations) {
      const { email, name, message, role = 'MEMBER' } = invitation;

      if (!email || !email.includes('@')) {
        errors.push({ email, error: req.t('communities:invalidEmail') });
        continue;
      }

      // Check if already a member
      const memberCheck = await pool.query(`
        SELECT cm.id, cm.status FROM community_members cm
        JOIN talents t ON cm.talent_id = t.id
        WHERE cm.community_id = $1 AND LOWER(t.email) = LOWER($2)
      `, [communityId, email]);

      if (memberCheck.rows.length > 0) {
        const status = memberCheck.rows[0].status;
        if (status === 'ACTIVE') {
          errors.push({ email, error: req.t('communities:alreadyMemberOfCommunity') });
          continue;
        }
      }

      // Check if pending invitation already exists
      const existingInvitation = await pool.query(`
        SELECT id FROM community_invitations
        WHERE community_id = $1 AND LOWER(invitee_email) = LOWER($2) AND status = 'PENDING'
      `, [communityId, email]);

      if (existingInvitation.rows.length > 0) {
        errors.push({ email, error: req.t('communities:pendingInvitationExists') });
        continue;
      }

      // Check if invitee is a registered user
      const talentCheck = await pool.query(`
        SELECT id, COALESCE(first_name || ' ' || last_name, email) as display_name FROM talents WHERE LOWER(email) = LOWER($1)
      `, [email]);

      const inviteeTalentId = talentCheck.rows.length > 0 ? talentCheck.rows[0].id : null;
      const inviteeName = name || (talentCheck.rows.length > 0 ? talentCheck.rows[0].display_name : null);

      // Generate invitation token for non-registered users
      const invitationToken = !inviteeTalentId ? crypto.randomBytes(32).toString('hex') : null;

      const id = uuidv4();
      await pool.query(`
        INSERT INTO community_invitations (
          id, community_id, invited_by, invitee_talent_id, invitee_email, 
          invitee_name, message, role, invitation_token, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      `, [id, communityId, talentId, inviteeTalentId, email.toLowerCase(), inviteeName, message, role, invitationToken]);

      results.push({
        id,
        email,
        name: inviteeName,
        role,
        is_registered_user: !!inviteeTalentId,
        status: 'PENDING',
      });

      // Send email notification
      try {
        // Get inviter name
        const inviterResult = await pool.query(
          'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name, first_name, last_name FROM talents WHERE id = $1',
          [talentId]
        );
        const inviter = inviterResult.rows[0];
        const inviterName = inviter?.display_name || `${inviter?.first_name || ''} ${inviter?.last_name || ''}`.trim() || 'Un membre';

        await sendCommunityInviteEmail(
          email,
          inviteeName,
          communityName,
          inviterName,
          role,
          message,
          invitationToken
        );
        logger.info(`📧 Community invitation email sent to ${email}`);
      } catch (emailError) {
        logger.error(`Failed to send invitation email to ${email}:`, emailError);
        // Don't fail the invitation if email fails
      }
    }

    const message = errors.length > 0
      ? req.t('communities:invitationsSentWithErrors', { sent: results.length, failed: errors.length })
      : req.t('communities:invitationsSent', { count: results.length });

    res.status(201).json({
      success: true,
      data: {
        sent: results.length,
        failed: errors.length,
        invitations: results,
        errors,
      },
      message,
    });
  } catch (error: any) {
    logger.error('Error sending invitations:', error);
    res.status(500).json({
      error: req.t('communities:errorSendingInvitations'),
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/communities/:communityId/invitations - Get all invitations for a community
 */
router.get('/:communityId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

    // Verify access (admin or org member)
    const accessCheck = await pool.query(`
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.status = 'ACTIVE'
      AND cm.role = 'ADMIN'
      UNION
      SELECT 1 FROM communities c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE c.id = $1 AND om.talent_id = $2
    `, [communityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('communities:accessNotAuthorized') });
    }

    let query = `
      SELECT 
        ci.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar
      FROM community_invitations ci
      JOIN talents t ON ci.invited_by = t.id
      WHERE ci.community_id = $1
    `;
    const params: any[] = [communityId];
    let paramIndex = 2;

    if (status) {
      query += ` AND ci.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY ci.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Get counts by status
    const countsResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM community_invitations
      WHERE community_id = $1
      GROUP BY status
    `, [communityId]);

    const statusCounts: Record<string, number> = {};
    countsResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    res.json({
      data: result.rows,
      count: result.rowCount,
      statusCounts,
    });
  } catch (error: any) {
    logger.error('Error fetching invitations:', error);
    res.status(500).json({ error: req.t('communities:errorFetchingInvitations') });
  }
});

/**
 * DELETE /api/communities/:communityId/invitations/:invitationId - Cancel an invitation (DELETE from DB)
 */
router.delete('/:communityId/invitations/:invitationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { communityId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.status = 'ACTIVE'
      AND cm.role = 'ADMIN'
      UNION
      SELECT 1 FROM communities c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE c.id = $1 AND om.talent_id = $2
    `, [communityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('communities:accessNotAuthorized') });
    }

    // DELETE the invitation from DB
    const result = await pool.query(`
      DELETE FROM community_invitations
      WHERE id = $1 AND community_id = $2
      RETURNING id
    `, [invitationId, communityId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:inviteNotFound') });
    }

    res.json({ success: true, message: req.t('communities:invitationCancelled') });
  } catch (error: any) {
    logger.error('Error cancelling invitation:', error);
    res.status(500).json({ error: req.t('communities:errorCancellingInvitation') });
  }
});

/**
 * POST /api/communities/:communityId/invitations/:invitationId/resend - Resend invitation email
 */
router.post('/:communityId/invitations/:invitationId/resend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { communityId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.status = 'ACTIVE'
      AND cm.role = 'ADMIN'
      UNION
      SELECT 1 FROM communities c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE c.id = $1 AND om.talent_id = $2
    `, [communityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('communities:accessNotAuthorized') });
    }

    const invitation = await pool.query(`
      SELECT ci.*, c.name as community_name
      FROM community_invitations ci
      JOIN communities c ON ci.community_id = c.id
      WHERE ci.id = $1 AND ci.community_id = $2 AND ci.status = 'PENDING'
    `, [invitationId, communityId]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:invitationNotFoundOrProcessed') });
    }

    // Update sent_at and extend expiration
    await pool.query(`
      UPDATE community_invitations
      SET sent_at = NOW(),
          expires_at = NOW() + INTERVAL '30 days',
          updated_at = NOW()
      WHERE id = $1
    `, [invitationId]);

    // Send email notification
    const inv = invitation.rows[0];
    try {
      const inviterResult = await pool.query(
        'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name, first_name, last_name FROM talents WHERE id = $1',
        [talentId]
      );
      const inviter = inviterResult.rows[0];
      const inviterName = inviter?.display_name || `${inviter?.first_name || ''} ${inviter?.last_name || ''}`.trim() || 'Un membre';

      await sendCommunityInviteEmail(
        inv.invitee_email,
        inv.invitee_name,
        inv.community_name,
        inviterName,
        inv.role,
        inv.message,
        inv.invitation_token
      );
      logger.info(`📧 Community invitation email resent to ${inv.invitee_email}`);
    } catch (emailError) {
      logger.error(`Failed to resend invitation email to ${inv.invitee_email}:`, emailError);
      // Don't fail the resend if email fails
    }

    res.json({ success: true, message: req.t('communities:invitationResent') });
  } catch (error: any) {
    logger.error('Error resending invitation:', error);
    res.status(500).json({ error: req.t('communities:errorResendingInvitation') });
  }
});

// ============================================================================
// USER INVITATION MANAGEMENT (for invitees)
// ============================================================================

/**
 * GET /api/community-invitations/me - Get invitations received by current user
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

    if (!talentId) {
      return res.status(401).json({ error: req.t('communities:notAuthenticated') });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:userNotFound') });
    }
    const userEmail = userResult.rows[0].email;

    let query = `
      SELECT 
        ci.*,
        c.id as community_id,
        c.name as community_name,
        c.description as community_description,
        c.cover_image_url,
        c.type as community_type,
        c.visibility,
        c.is_paid,
        c.monthly_price,
        c.currency,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'ACTIVE') as members_count,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'logo_url', o.logo_url
        ) as organization
      FROM community_invitations ci
      JOIN communities c ON ci.community_id = c.id
      JOIN talents t ON ci.invited_by = t.id
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE (ci.invitee_talent_id = $1 OR LOWER(ci.invitee_email) = LOWER($2))
      AND c.deleted_at IS NULL
    `;
    const params: any[] = [talentId, userEmail];
    let paramIndex = 3;

    if (status) {
      query += ` AND ci.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY ci.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Get counts by status
    const countsResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM community_invitations
      WHERE invitee_talent_id = $1 OR LOWER(invitee_email) = LOWER($2)
      GROUP BY status
    `, [talentId, userEmail]);

    const statusCounts: Record<string, number> = {};
    countsResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    res.json({
      data: result.rows,
      count: result.rowCount,
      statusCounts,
    });
  } catch (error: any) {
    logger.error('Error fetching user invitations:', error);
    res.status(500).json({ error: req.t('communities:errorFetchingUserInvitations') });
  }
});

/**
 * POST /api/community-invitations/:invitationId/accept - Accept an invitation
 */
router.post('/:invitationId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: req.t('communities:notAuthenticated') });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:userNotFound') });
    }
    const userEmail = userResult.rows[0].email;

    // Verify invitation belongs to user and is pending
    const invitation = await pool.query(`
      SELECT ci.*, c.name as community_name, c.is_paid, c.monthly_price, c.currency
      FROM community_invitations ci
      JOIN communities c ON ci.community_id = c.id
      WHERE ci.id = $1 
      AND (ci.invitee_talent_id = $2 OR LOWER(ci.invitee_email) = LOWER($3))
      AND ci.status = 'PENDING'
      AND c.deleted_at IS NULL
    `, [invitationId, talentId, userEmail]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:invitationNotFoundOrProcessed') });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await pool.query(`
        UPDATE community_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1
      `, [invitationId]);
      return res.status(400).json({ error: req.t('communities:invitationExpired') });
    }

    // If community is paid, redirect to payment flow
    if (inv.is_paid && inv.monthly_price > 0) {
      return res.json({
        requires_payment: true,
        community_id: inv.community_id,
        community_name: inv.community_name,
        monthly_price: inv.monthly_price,
        currency: inv.currency,
        invitation_id: invitationId,
        message: req.t('communities:requiresPayment'),
      });
    }

    // Check if already a member
    const existingMember = await pool.query(`
      SELECT id, status FROM community_members
      WHERE community_id = $1 AND talent_id = $2
    `, [inv.community_id, talentId]);

    if (existingMember.rows.length > 0) {
      const memberStatus = existingMember.rows[0].status;
      if (memberStatus === 'ACTIVE') {
        // Already a member, just DELETE the invitation
        await pool.query('DELETE FROM community_invitations WHERE id = $1', [invitationId]);
        return res.json({ success: true, message: req.t('communities:alreadyMemberMessage') });
      }
      // Update existing membership to active
      await pool.query(`
        UPDATE community_members
        SET status = 'ACTIVE', role = $1, joined_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [inv.role || 'MEMBER', existingMember.rows[0].id]);
    } else {
      // Create new membership
      const memberId = uuidv4();
      await pool.query(`
        INSERT INTO community_members (id, community_id, talent_id, role, status, membership_type, joined_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'ACTIVE', 'MEMBER', NOW(), NOW(), NOW())
      `, [memberId, inv.community_id, talentId, inv.role || 'MEMBER']);
    }

    // DELETE the invitation from DB (access granted)
    await pool.query('DELETE FROM community_invitations WHERE id = $1', [invitationId]);

    res.json({
      success: true,
      message: req.t('communities:welcomeToCommunity', { name: inv.community_name }),
      community_id: inv.community_id,
    });
  } catch (error: any) {
    logger.error('Error accepting invitation:', error);
    res.status(500).json({ error: req.t('communities:errorAcceptingInvitation') });
  }
});

/**
 * POST /api/community-invitations/:invitationId/decline - Decline an invitation (DELETE from DB)
 */
router.post('/:invitationId/decline', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: req.t('communities:notAuthenticated') });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:userNotFound') });
    }
    const userEmail = userResult.rows[0].email;

    // Verify invitation belongs to user and DELETE
    const result = await pool.query(`
      DELETE FROM community_invitations
      WHERE id = $1
      AND (invitee_talent_id = $2 OR LOWER(invitee_email) = LOWER($3))
      RETURNING id
    `, [invitationId, talentId, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:inviteNotFound') });
    }

    res.json({ success: true, message: req.t('communities:inviteDeclined') });
  } catch (error: any) {
    logger.error('Error declining invitation:', error);
    res.status(500).json({ error: req.t('communities:errorDecliningInvitation') });
  }
});

/**
 * GET /api/community-invitations/token/:token - Verify invitation by token (for email links)
 */
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await pool.query(`
      SELECT 
        ci.*,
        c.name as community_name,
        c.description as community_description,
        c.cover_image_url,
        c.is_paid,
        c.monthly_price,
        c.currency,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name
      FROM community_invitations ci
      JOIN communities c ON ci.community_id = c.id
      JOIN talents t ON ci.invited_by = t.id
      WHERE ci.invitation_token = $1 AND ci.status = 'PENDING'
    `, [token]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: req.t('communities:invalidOrExpiredInvitation') });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await pool.query(`
        UPDATE community_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1
      `, [inv.id]);
      return res.status(400).json({ error: req.t('communities:invitationExpired') });
    }

    // Mark as viewed
    await pool.query(`
      UPDATE community_invitations SET viewed_at = COALESCE(viewed_at, NOW()), updated_at = NOW() WHERE id = $1
    `, [inv.id]);

    res.json({
      data: {
        id: inv.id,
        community_name: inv.community_name,
        community_description: inv.community_description,
        cover_image_url: inv.cover_image_url,
        invited_by_name: inv.invited_by_name,
        message: inv.message,
        role: inv.role,
        is_paid: inv.is_paid,
        monthly_price: inv.monthly_price,
        currency: inv.currency,
        expires_at: inv.expires_at,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying invitation token:', error);
    res.status(500).json({ error: req.t('communities:errorVerifyingInvitation') });
  }
});

export default router;
