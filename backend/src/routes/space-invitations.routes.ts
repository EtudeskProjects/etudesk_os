/**
 * Space Invitations Routes
 * Handles sending, accepting, declining invitations for spaces
 * Note: Invitations are DELETED (not status-updated) on accept/decline/cancel
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { sendSpaceInviteEmail } from '../services/email.service';

import { logger } from '../utils';
const router = Router();

// ============================================================================
// INVITATION MANAGEMENT (for space admins)
// ============================================================================

/**
 * POST /api/spaces/:spaceId/invitations - Send invitation(s)
 * Body: { invitations: [{ email, name?, message? }] }
 */
router.post('/:spaceId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { spaceId } = req.params;
    const talentId = req.talentId;
    const { invitations } = req.body;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({ error: 'Au moins une invitation est requise' });
    }

    if (invitations.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 invitations a la fois' });
    }

    // Verify user has access to the space (via org membership)
    const accessCheck = await pool.query(`
      SELECT s.name as space_name, s.organization_id,
             COALESCE(t.first_name || ' ' || t.last_name, t.email) as inviter_name
      FROM spaces s
      JOIN organization_members om ON s.organization_id = om.organization_id
      LEFT JOIN talents t ON t.id = $2
      WHERE s.id = $1 AND s.deleted_at IS NULL AND om.talent_id = $2
    `, [spaceId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour inviter des personnes' });
    }

    const spaceName = accessCheck.rows[0].space_name;
    const inviterName = accessCheck.rows[0].inviter_name || '';
    const results: any[] = [];
    const errors: any[] = [];

    for (const invitation of invitations) {
      const { email, name, message } = invitation;

      if (!email || !email.includes('@')) {
        errors.push({ email, error: 'Email invalide' });
        continue;
      }

      // Check if pending invitation already exists
      const existingInvitation = await pool.query(`
        SELECT id FROM space_invitations
        WHERE space_id = $1 AND LOWER(invitee_email) = LOWER($2)
      `, [spaceId, email]);

      if (existingInvitation.rows.length > 0) {
        errors.push({ email, error: 'Une invitation existe deja' });
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
        INSERT INTO space_invitations (
          id, space_id, invited_by, invitee_talent_id, invitee_email,
          invitee_name, message, invitation_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, spaceId, talentId, inviteeTalentId, email.toLowerCase(), inviteeName, message, invitationToken]);

      results.push({
        id,
        email,
        name: inviteeName,
        is_registered_user: !!inviteeTalentId,
      });

      // Send email notification (fire-and-forget)
      if (invitationToken) {
        sendSpaceInviteEmail(email, inviteeName, spaceName, inviterName, message, invitationToken).catch(() => {});
      }
    }

    res.status(201).json({
      success: true,
      data: {
        sent: results.length,
        failed: errors.length,
        invitations: results,
        errors,
      },
      message: `${results.length} invitation(s) envoyee(s)${errors.length > 0 ? `, ${errors.length} echec(s)` : ''}`,
    });
  } catch (error: any) {
    logger.error('Error sending space invitations:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi des invitations',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/spaces/:spaceId/invitations - Get all invitations for a space
 */
router.get('/:spaceId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { spaceId } = req.params;
    const talentId = req.talentId;
    const { limit = 50, offset = 0 } = req.query;

    // Verify access (org member)
    const accessCheck = await pool.query(`
      SELECT 1 FROM spaces s
      JOIN organization_members om ON s.organization_id = om.organization_id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND om.talent_id = $2
    `, [spaceId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    const result = await pool.query(`
      SELECT
        si.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar
      FROM space_invitations si
      JOIN talents t ON si.invited_by = t.id
      WHERE si.space_id = $1
      ORDER BY si.created_at DESC
      LIMIT $2 OFFSET $3
    `, [spaceId, Number(limit), Number(offset)]);

    // Get count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM space_invitations
      WHERE space_id = $1
    `, [spaceId]);

    res.json({
      data: result.rows,
      count: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error: any) {
    logger.error('Error fetching space invitations:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des invitations' });
  }
});

/**
 * DELETE /api/spaces/:spaceId/invitations/:invitationId - Cancel an invitation (DELETE from DB)
 */
router.delete('/:spaceId/invitations/:invitationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { spaceId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM spaces s
      JOIN organization_members om ON s.organization_id = om.organization_id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND om.talent_id = $2
    `, [spaceId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    // DELETE the invitation from DB
    const result = await pool.query(`
      DELETE FROM space_invitations
      WHERE id = $1 AND space_id = $2
      RETURNING id
    `, [invitationId, spaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    res.json({ success: true, message: 'Invitation annulee' });
  } catch (error: any) {
    logger.error('Error cancelling space invitation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'invitation' });
  }
});

/**
 * POST /api/spaces/:spaceId/invitations/:invitationId/resend - Resend invitation email
 */
router.post('/:spaceId/invitations/:invitationId/resend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { spaceId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM spaces s
      JOIN organization_members om ON s.organization_id = om.organization_id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND om.talent_id = $2
    `, [spaceId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    const invitation = await pool.query(`
      SELECT si.*, s.name as space_name
      FROM space_invitations si
      JOIN spaces s ON si.space_id = s.id
      WHERE si.id = $1 AND si.space_id = $2
    `, [invitationId, spaceId]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    // Update sent_at and extend expiration
    await pool.query(`
      UPDATE space_invitations
      SET sent_at = NOW(),
          expires_at = NOW() + INTERVAL '30 days'
      WHERE id = $1
    `, [invitationId]);

    // Send email notification (fire-and-forget)
    const inv = invitation.rows[0];
    sendSpaceInviteEmail(
      inv.invitee_email,
      inv.invitee_name,
      inv.space_name,
      inv.inviter_name || 'Un gestionnaire',
      inv.message,
      inv.invitation_token
    ).catch(() => {});

    res.json({ success: true, message: 'Invitation renvoyee' });
  } catch (error: any) {
    logger.error('Error resending space invitation:', error);
    res.status(500).json({ error: 'Erreur lors du renvoi de l\'invitation' });
  }
});

// ============================================================================
// USER INVITATION MANAGEMENT (for invitees)
// ============================================================================

/**
 * GET /api/space-invitations/me - Get invitations received by current user
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { limit = 50, offset = 0 } = req.query;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }
    const userEmail = userResult.rows[0].email;

    const result = await pool.query(`
      SELECT
        si.*,
        s.id as space_id,
        s.name as space_name,
        s.description as space_description,
        s.cover_image_url,
        s.type as space_type,
        s.city,
        s.country,
        s.hourly_rate,
        s.daily_rate,
        s.capacity,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'logo_url', o.logo_url
        ) as organization
      FROM space_invitations si
      JOIN spaces s ON si.space_id = s.id
      JOIN talents t ON si.invited_by = t.id
      LEFT JOIN organizations o ON s.organization_id = o.id
      WHERE (si.invitee_talent_id = $1 OR LOWER(si.invitee_email) = LOWER($2))
      AND s.deleted_at IS NULL
      ORDER BY si.created_at DESC
      LIMIT $3 OFFSET $4
    `, [talentId, userEmail, Number(limit), Number(offset)]);

    // Get count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM space_invitations si
      JOIN spaces s ON si.space_id = s.id
      WHERE (si.invitee_talent_id = $1 OR LOWER(si.invitee_email) = LOWER($2))
      AND s.deleted_at IS NULL
    `, [talentId, userEmail]);

    res.json({
      data: result.rows,
      count: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error: any) {
    logger.error('Error fetching user space invitations:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des invitations' });
  }
});

/**
 * POST /api/space-invitations/:invitationId/accept - Accept an invitation (then DELETE)
 */
router.post('/:invitationId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }
    const userEmail = userResult.rows[0].email;

    // Verify invitation belongs to user
    const invitation = await pool.query(`
      SELECT si.*, s.name as space_name, s.id as space_id
      FROM space_invitations si
      JOIN spaces s ON si.space_id = s.id
      WHERE si.id = $1
      AND (si.invitee_talent_id = $2 OR LOWER(si.invitee_email) = LOWER($3))
      AND s.deleted_at IS NULL
    `, [invitationId, talentId, userEmail]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      // DELETE expired invitation
      await pool.query('DELETE FROM space_invitations WHERE id = $1', [invitationId]);
      return res.status(400).json({ error: 'Cette invitation a expire' });
    }

    // For spaces, accepting means the user can now book the space
    // We grant them access by deleting the invitation

    // DELETE the invitation from DB (access granted)
    await pool.query('DELETE FROM space_invitations WHERE id = $1', [invitationId]);

    res.json({
      success: true,
      message: `Invitation acceptee pour "${inv.space_name}"`,
      space_id: inv.space_id,
    });
  } catch (error: any) {
    logger.error('Error accepting space invitation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation de l\'invitation' });
  }
});

/**
 * POST /api/space-invitations/:invitationId/decline - Decline an invitation (DELETE)
 */
router.post('/:invitationId/decline', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    // Get user's email
    const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }
    const userEmail = userResult.rows[0].email;

    // Verify invitation belongs to user and DELETE
    const result = await pool.query(`
      DELETE FROM space_invitations
      WHERE id = $1
      AND (invitee_talent_id = $2 OR LOWER(invitee_email) = LOWER($3))
      RETURNING id
    `, [invitationId, talentId, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    res.json({ success: true, message: 'Invitation declinee' });
  } catch (error: any) {
    logger.error('Error declining space invitation:', error);
    res.status(500).json({ error: 'Erreur lors du refus de l\'invitation' });
  }
});

/**
 * GET /api/space-invitations/token/:token - Verify invitation by token (for email links)
 */
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await pool.query(`
      SELECT
        si.*,
        s.name as space_name,
        s.description as space_description,
        s.cover_image_url,
        s.type as space_type,
        s.hourly_rate,
        s.daily_rate,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name
      FROM space_invitations si
      JOIN spaces s ON si.space_id = s.id
      JOIN talents t ON si.invited_by = t.id
      WHERE si.invitation_token = $1
    `, [token]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation invalide ou expiree' });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await pool.query('DELETE FROM space_invitations WHERE id = $1', [inv.id]);
      return res.status(400).json({ error: 'Cette invitation a expire' });
    }

    res.json({
      data: {
        id: inv.id,
        space_id: inv.space_id,
        space_name: inv.space_name,
        space_description: inv.space_description,
        cover_image_url: inv.cover_image_url,
        space_type: inv.space_type,
        hourly_rate: inv.hourly_rate,
        daily_rate: inv.daily_rate,
        invited_by_name: inv.invited_by_name,
        message: inv.message,
        expires_at: inv.expires_at,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying space invitation token:', error);
    res.status(500).json({ error: 'Erreur lors de la verification de l\'invitation' });
  }
});

export default router;
