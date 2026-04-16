/**
 * Organization Members Routes
 * Handles organization member management (invite, update role, remove)
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { sendOrganizationInviteEmail } from '../services/email.service';

import { logger } from '../utils';
const router = Router();

// Valid roles (synchronized with mobile)
// OWNER: Full control (implicit)
// ADMIN: Can do everything except delete organization
// MANAGER: Can manage opportunities, communities, spaces (CRUD)
// OBSERVER: Can only view (read-only)
const VALID_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'OBSERVER'];

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  OBSERVER: 1,
};

// Helper to check if role can perform action
const canManageContent = (role: string) => ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
const canManageMembers = (role: string) => ['OWNER', 'ADMIN'].includes(role);
const canInviteMembers = (role: string) => ['OWNER', 'ADMIN'].includes(role);

/**
 * GET /api/organizations/:orgId/members
 * List all members of an organization
 */
router.get('/:orgId/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check if organization exists
    const orgCheck = await pool.query(`
      SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL
    `, [orgId]);

    if (orgCheck.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:notFound') });
    }

    // Check if user is a member of this organization
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const result = await pool.query(`
      SELECT
        om.id, om.organization_id, om.talent_id as user_id, om.role,
        om.joined_at, om.created_at, om.updated_at,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.avatar_url, t.email, t.bio as title
      FROM organization_members om
      JOIN talents t ON om.talent_id = t.id
      WHERE om.organization_id = $1
      ORDER BY
        CASE om.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
          WHEN 'MANAGER' THEN 3
          WHEN 'OBSERVER' THEN 4
        END,
        om.joined_at ASC
    `, [orgId]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    logger.error('Error fetching organization members:', error);
    res.status(500).json({ error: req.t('organizations:fetchMembersError') });
  }
});

/**
 * GET /api/organizations/:orgId/invitations
 * List pending invitations
 */
router.get('/:orgId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check if user has permission to view invitations
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const result = await pool.query(`
      SELECT
        oi.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name
      FROM organization_invitations oi
      LEFT JOIN talents t ON oi.invited_by = t.id
      WHERE oi.organization_id = $1 AND oi.status = 'PENDING'
      ORDER BY oi.created_at DESC
    `, [orgId]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    logger.error('Error fetching invitations:', error);
    res.status(500).json({ error: req.t('organizations:fetchInvitationsError') });
  }
});

/**
 * POST /api/organizations/:orgId/invitations
 * Invite a member to the organization
 */
router.post('/:orgId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { email, role } = req.body;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: req.t('organizations:validEmailRequired') });
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: req.t('organizations:invalidRole'), validRoles: VALID_ROLES });
    }

    // Check if user has permission to invite
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const currentRole = memberCheck.rows[0].role;

    if (!canInviteMembers(currentRole)) {
      return res.status(403).json({ error: req.t('organizations:noInvitePermission') });
    }

    // Cannot invite with higher role than yourself
    const inviteRole = role || 'OBSERVER';
    if (ROLE_HIERARCHY[inviteRole] >= ROLE_HIERARCHY[currentRole]) {
      return res.status(403).json({ error: req.t('organizations:cannotInviteHigherRole') });
    }

    // Check if already a member
    const existingMember = await pool.query(`
      SELECT om.id FROM organization_members om
      JOIN talents t ON om.talent_id = t.id
      WHERE om.organization_id = $1 AND t.email = $2
    `, [orgId, email.toLowerCase()]);

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: req.t('organizations:alreadyMember') });
    }

    // Check if invitation already exists
    const existingInvite = await pool.query(`
      SELECT id FROM organization_invitations
      WHERE organization_id = $1 AND email = $2 AND status = 'PENDING'
    `, [orgId, email.toLowerCase()]);

    if (existingInvite.rows.length > 0) {
      return res.status(400).json({ error: req.t('organizations:invitationAlreadyPending') });
    }

    // Create invitation
    const id = uuidv4();
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await pool.query(`
      INSERT INTO organization_invitations (
        id, organization_id, email, role, token,
        invited_by, expires_at, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW()
      ) RETURNING *
    `, [id, orgId, email.toLowerCase(), inviteRole, token, req.talentId, expiresAt]);

    // Get organization name and inviter name for email
    const orgInfo = await pool.query(`
      SELECT o.name as org_name, COALESCE(t.first_name || ' ' || t.last_name, t.email) as inviter_name
      FROM organizations o, talents t
      WHERE o.id = $1 AND t.id = $2
    `, [orgId, req.talentId]);

    if (orgInfo.rows.length > 0) {
      const { org_name, inviter_name } = orgInfo.rows[0];
      // Send invitation email (don't wait for it)
      sendOrganizationInviteEmail(
        email.toLowerCase(),
        org_name,
        inviter_name,
        inviteRole,
        token
      ).catch(err => logger.error('Failed to send invitation email:', err));
    }

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating invitation:', error);
    res.status(500).json({ error: req.t('organizations:createInvitationError') });
  }
});

/**
 * PUT /api/organizations/:orgId/members/:memberId
 * Update member role
 */
router.put('/:orgId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, memberId } = req.params;
    const { role } = req.body;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check if user has permission to edit members
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const currentRole = memberCheck.rows[0].role;

    if (!canManageMembers(currentRole)) {
      return res.status(403).json({ error: req.t('organizations:noEditMemberPermission') });
    }

    // Get target member
    const targetMember = await pool.query(`
      SELECT role FROM organization_members WHERE id = $1 AND organization_id = $2
    `, [memberId, orgId]);

    if (targetMember.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:memberRemoved') });
    }

    // Cannot edit owner unless you are owner
    if (targetMember.rows[0].role === 'OWNER' && currentRole !== 'OWNER') {
      return res.status(403).json({ error: req.t('organizations:cannotModifyOwner') });
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: req.t('organizations:invalidRole') });
    }

    // Cannot assign higher role than yourself
    if (role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[currentRole]) {
      return res.status(403).json({ error: req.t('organizations:cannotAssignHigherRole') });
    }

    const result = await pool.query(`
      UPDATE organization_members SET
        role = COALESCE($1, role),
        updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      RETURNING *
    `, [role || null, memberId, orgId]);

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating member:', error);
    res.status(500).json({ error: req.t('organizations:updateMemberError') });
  }
});

/**
 * DELETE /api/organizations/:orgId/members/:memberId
 * Remove a member from the organization
 */
router.delete('/:orgId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, memberId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check if user has permission to remove members
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const currentRole = memberCheck.rows[0].role;

    if (!canManageMembers(currentRole)) {
      return res.status(403).json({ error: req.t('organizations:noRemoveMemberPermission') });
    }

    // Get target member
    const targetMember = await pool.query(`
      SELECT role, talent_id FROM organization_members WHERE id = $1 AND organization_id = $2
    `, [memberId, orgId]);

    if (targetMember.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:memberRemoved') });
    }

    // Cannot remove owner
    if (targetMember.rows[0].role === 'OWNER') {
      return res.status(403).json({ error: req.t('organizations:cannotRemoveOwner') });
    }

    // Cannot remove yourself (use leave instead)
    if (targetMember.rows[0].talent_id === req.talentId) {
      return res.status(400).json({ error: req.t('organizations:useLeaveInstead') });
    }

    await pool.query(`
      DELETE FROM organization_members WHERE id = $1 AND organization_id = $2
    `, [memberId, orgId]);

    res.json({ success: true, message: req.t('organizations:memberRemoved') });
  } catch (error) {
    logger.error('Error removing member:', error);
    res.status(500).json({ error: req.t('organizations:removeMemberError') });
  }
});

/**
 * DELETE /api/organizations/:orgId/invitations/:invitationId
 * Cancel an invitation
 */
router.delete('/:orgId/invitations/:invitationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, invitationId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check permission
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const currentRole = memberCheck.rows[0].role;

    if (!canInviteMembers(currentRole)) {
      return res.status(403).json({ error: req.t('organizations:noCancelInvitePermission') });
    }

    const result = await pool.query(`
      UPDATE organization_invitations
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND status = 'PENDING'
      RETURNING id
    `, [invitationId, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:inviteNotFoundOrProcessed') });
    }

    res.json({ success: true, message: req.t('organizations:invitationCancelled') });
  } catch (error) {
    logger.error('Error cancelling invitation:', error);
    res.status(500).json({ error: req.t('organizations:cancelInvitationError') });
  }
});

/**
 * POST /api/organizations/:orgId/invitations/:invitationId/resend
 * Resend an invitation
 */
router.post('/:orgId/invitations/:invitationId/resend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, invitationId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Check permission
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [orgId, req.talentId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: req.t('organizations:notMember') });
    }

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await pool.query(`
      UPDATE organization_invitations
      SET expires_at = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3 AND status = 'PENDING'
      RETURNING *
    `, [newExpiresAt, invitationId, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:inviteNotFoundOrProcessed') });
    }

    // Resend invitation email
    const invitation = result.rows[0];
    const orgInfo = await pool.query(`
      SELECT o.name as org_name, COALESCE(t.first_name || ' ' || t.last_name, t.email) as inviter_name
      FROM organizations o, talents t
      WHERE o.id = $1 AND t.id = $2
    `, [orgId, req.talentId]);

    if (orgInfo.rows.length > 0) {
      const { org_name, inviter_name } = orgInfo.rows[0];
      sendOrganizationInviteEmail(
        invitation.email,
        org_name,
        inviter_name,
        invitation.role,
        invitation.token
      ).catch(err => logger.error('Failed to resend invitation email:', err));
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error resending invitation:', error);
    res.status(500).json({ error: req.t('organizations:resendInvitationError') });
  }
});

// ============================================================
// USER INVITATION ROUTES (for the invited user)
// ============================================================

/**
 * GET /api/invitations/received
 * List all pending invitations for the current user
 */
router.get('/invitations/received', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Get user email from talent
    let userResult;
    try {
      userResult = await pool.query(`
        SELECT email FROM talents WHERE id = $1
      `, [req.talentId]);
    } catch (dbError: any) {
      // Handle connection errors
      if (dbError.code === 'ECONNRESET' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ETIMEDOUT') {
        logger.error('Database connection error fetching received invitations:', dbError);
        return res.status(503).json({ error: req.t('common:serviceUnavailable') });
      }
      throw dbError;
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('common:userNotFound') });
    }

    const userEmail = userResult.rows[0].email;
    if (!userEmail) {
      return res.json({ data: [], count: 0 });
    }

    // Get pending invitations for this email
    let result;
    try {
      result = await pool.query(`
        SELECT
          oi.id, oi.organization_id, oi.email, oi.role,
          oi.token, oi.expires_at, oi.status, oi.created_at,
          o.name as organization_name, o.logo_url as organization_logo,
          o.types as organization_types, o.sectors as organization_sectors,
          COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name, t.avatar_url as invited_by_avatar
        FROM organization_invitations oi
        JOIN organizations o ON oi.organization_id = o.id
        LEFT JOIN talents t ON oi.invited_by = t.id
        WHERE oi.email = $1
          AND oi.status = 'PENDING'
          AND oi.expires_at > NOW()
          AND o.deleted_at IS NULL
        ORDER BY oi.created_at DESC
      `, [userEmail.toLowerCase()]);
    } catch (dbError: any) {
      // Handle connection errors
      if (dbError.code === 'ECONNRESET' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ETIMEDOUT') {
        logger.error('Database connection error fetching received invitations:', dbError);
        return res.status(503).json({ error: req.t('common:serviceUnavailable') });
      }
      throw dbError;
    }

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error: any) {
    logger.error('Error fetching received invitations:', error);

    // Handle specific database connection errors
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: req.t('common:serviceUnavailable') });
    }

    res.status(500).json({ error: req.t('organizations:fetchReceivedInvitationsError') });
  }
});

/**
 * POST /api/invitations/:invitationId/accept
 * Accept an invitation
 */
router.post('/invitations/:invitationId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Get user email
    const userResult = await pool.query(`
      SELECT email FROM talents WHERE id = $1
    `, [req.talentId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('common:userNotFound') });
    }

    const userEmail = userResult.rows[0].email.toLowerCase();

    // Get the invitation
    const inviteResult = await pool.query(`
      SELECT * FROM organization_invitations
      WHERE id = $1 AND email = $2 AND status = 'PENDING'
    `, [invitationId, userEmail]);

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:inviteNotFoundOrProcessed') });
    }

    const invitation = inviteResult.rows[0];

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await pool.query(`
        UPDATE organization_invitations SET status = 'EXPIRED', updated_at = NOW()
        WHERE id = $1
      `, [invitationId]);
      return res.status(400).json({ error: req.t('organizations:invitationExpired') });
    }

    // Check if already a member
    const existingMember = await pool.query(`
      SELECT id FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [invitation.organization_id, req.talentId]);

    if (existingMember.rows.length > 0) {
      // Update invitation status and return error
      await pool.query(`
        UPDATE organization_invitations SET status = 'ACCEPTED', updated_at = NOW()
        WHERE id = $1
      `, [invitationId]);
      return res.status(400).json({ error: req.t('organizations:alreadyOrgMember') });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create member
      const memberId = uuidv4();
      await client.query(`
        INSERT INTO organization_members (
          id, organization_id, talent_id, role, joined_at, created_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [memberId, invitation.organization_id, req.talentId, invitation.role]);

      // Update invitation status
      await client.query(`
        UPDATE organization_invitations SET status = 'ACCEPTED', updated_at = NOW()
        WHERE id = $1
      `, [invitationId]);

      await client.query('COMMIT');

      // Get organization info for response
      const orgResult = await pool.query(`
        SELECT id, name, slug, logo_url FROM organizations WHERE id = $1
      `, [invitation.organization_id]);

      res.json({
        success: true,
        message: req.t('organizations:invitationAccepted'),
        data: {
          member_id: memberId,
          organization: orgResult.rows[0],
          role: invitation.role,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error accepting invitation:', error);
    res.status(500).json({ error: req.t('organizations:acceptInvitationError') });
  }
});

/**
 * POST /api/invitations/:invitationId/decline
 * Decline an invitation
 */
router.post('/invitations/:invitationId/decline', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;

    if (!req.talentId) {
      return res.status(403).json({ error: req.t('organizations:authRequired') });
    }

    // Get user email
    const userResult = await pool.query(`
      SELECT email FROM talents WHERE id = $1
    `, [req.talentId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('common:userNotFound') });
    }

    const userEmail = userResult.rows[0].email.toLowerCase();

    // Update invitation status
    const result = await pool.query(`
      UPDATE organization_invitations
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1 AND email = $2 AND status = 'PENDING'
      RETURNING id, organization_id
    `, [invitationId, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:inviteNotFoundOrProcessed') });
    }

    res.json({ success: true, message: req.t('organizations:invitationDeclined') });
  } catch (error) {
    logger.error('Error declining invitation:', error);
    res.status(500).json({ error: req.t('organizations:declineInvitationError') });
  }
});

/**
 * GET /api/invitations/by-token/:token
 * Get invitation details by token (for deep linking)
 */
router.get('/invitations/by-token/:token', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    const result = await pool.query(`
      SELECT
        oi.id, oi.organization_id, oi.email, oi.role, oi.expires_at, oi.status,
        o.name as organization_name, o.logo_url as organization_logo,
        o.types as organization_types,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      LEFT JOIN talents t ON oi.invited_by = t.id
      WHERE oi.token = $1 AND o.deleted_at IS NULL
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('organizations:inviteNotFound') });
    }

    const invitation = result.rows[0];

    // Check status
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({
        error: invitation.status === 'ACCEPTED'
          ? req.t('organizations:inviteAlreadyAccepted')
          : invitation.status === 'EXPIRED'
          ? req.t('organizations:inviteAlreadyExpired')
          : req.t('organizations:inviteAlreadyCancelled'),
        status: invitation.status
      });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: req.t('organizations:invitationExpired'), status: 'EXPIRED' });
    }

    res.json({ data: invitation });
  } catch (error) {
    logger.error('Error fetching invitation by token:', error);
    res.status(500).json({ error: req.t('organizations:fetchInvitationByTokenError') });
  }
});

export default router;
