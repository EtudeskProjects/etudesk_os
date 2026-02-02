/**
 * Opportunity Invitations Routes
 * Handles sending, accepting, declining invitations for opportunities
 * Note: Unlike community invitations, these are DELETED (not status-updated) on accept/decline/cancel
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { sendOpportunityInviteEmail } from '../services/email.service';

const router = Router();

// ============================================================================
// INVITATION MANAGEMENT (for opportunity admins)
// ============================================================================

/**
 * POST /api/opportunities/:opportunityId/invitations - Send invitation(s)
 * Body: { invitations: [{ email, name?, message? }] }
 */
router.post('/:opportunityId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
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

    // Verify user has access to the opportunity (via org membership)
    const accessCheck = await pool.query(`
      SELECT o.title as opportunity_title, o.organization_id,
             org.name as organization_name,
             COALESCE(t.first_name || ' ' || t.last_name, t.email) as inviter_name
      FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      LEFT JOIN talents t ON t.id = $2
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour inviter des personnes' });
    }

    const opportunityTitle = accessCheck.rows[0].opportunity_title;
    const organizationName = accessCheck.rows[0].organization_name || '';
    const inviterName = accessCheck.rows[0].inviter_name || '';
    const results: any[] = [];
    const errors: any[] = [];

    for (const invitation of invitations) {
      const { email, name, message } = invitation;

      if (!email || !email.includes('@')) {
        errors.push({ email, error: 'Email invalide' });
        continue;
      }

      // Check if already applied
      const applicationCheck = await pool.query(`
        SELECT oa.id FROM opportunity_applications oa
        JOIN talents t ON oa.talent_id = t.id
        WHERE oa.opportunity_id = $1 AND LOWER(t.email) = LOWER($2)
      `, [opportunityId, email]);

      if (applicationCheck.rows.length > 0) {
        errors.push({ email, error: 'Cette personne a deja postule' });
        continue;
      }

      // Check if pending invitation already exists
      const existingInvitation = await pool.query(`
        SELECT id FROM opportunity_invitations
        WHERE opportunity_id = $1 AND LOWER(invitee_email) = LOWER($2)
      `, [opportunityId, email]);

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
        INSERT INTO opportunity_invitations (
          id, opportunity_id, invited_by, invitee_talent_id, invitee_email,
          invitee_name, message, invitation_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, opportunityId, talentId, inviteeTalentId, email.toLowerCase(), inviteeName, message, invitationToken]);

      results.push({
        id,
        email,
        name: inviteeName,
        is_registered_user: !!inviteeTalentId,
      });

      // Send email notification (fire-and-forget)
      if (invitationToken) {
        sendOpportunityInviteEmail(email, inviteeName, opportunityTitle, organizationName, inviterName, message, invitationToken).catch(() => {});
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
    console.error('Error sending opportunity invitations:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'envoi des invitations',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/opportunities/:opportunityId/invitations - Get all invitations for an opportunity
 */
router.get('/:opportunityId/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const talentId = req.talentId;
    const { limit = 50, offset = 0 } = req.query;

    // Verify access (org member)
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    const result = await pool.query(`
      SELECT
        oi.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar
      FROM opportunity_invitations oi
      JOIN talents t ON oi.invited_by = t.id
      WHERE oi.opportunity_id = $1
      ORDER BY oi.created_at DESC
      LIMIT $2 OFFSET $3
    `, [opportunityId, Number(limit), Number(offset)]);

    // Get count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM opportunity_invitations
      WHERE opportunity_id = $1
    `, [opportunityId]);

    res.json({
      data: result.rows,
      count: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error: any) {
    console.error('Error fetching opportunity invitations:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des invitations' });
  }
});

/**
 * DELETE /api/opportunities/:opportunityId/invitations/:invitationId - Cancel an invitation (DELETE from DB)
 */
router.delete('/:opportunityId/invitations/:invitationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    // DELETE the invitation from DB
    const result = await pool.query(`
      DELETE FROM opportunity_invitations
      WHERE id = $1 AND opportunity_id = $2
      RETURNING id
    `, [invitationId, opportunityId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    res.json({ success: true, message: 'Invitation annulee' });
  } catch (error: any) {
    console.error('Error cancelling opportunity invitation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'invitation' });
  }
});

/**
 * POST /api/opportunities/:opportunityId/invitations/:invitationId/resend - Resend invitation email
 */
router.post('/:opportunityId/invitations/:invitationId/resend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { opportunityId, invitationId } = req.params;
    const talentId = req.talentId;

    // Verify access
    const accessCheck = await pool.query(`
      SELECT 1 FROM opportunities o
      JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      AND (op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [opportunityId, talentId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Acces non autorise' });
    }

    const invitation = await pool.query(`
      SELECT oi.*, o.title as opportunity_title
      FROM opportunity_invitations oi
      JOIN opportunities o ON oi.opportunity_id = o.id
      WHERE oi.id = $1 AND oi.opportunity_id = $2
    `, [invitationId, opportunityId]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    // Update sent_at and extend expiration
    await pool.query(`
      UPDATE opportunity_invitations
      SET sent_at = NOW(),
          expires_at = NOW() + INTERVAL '30 days'
      WHERE id = $1
    `, [invitationId]);

    // Send email notification (fire-and-forget)
    const inv = invitation.rows[0];
    sendOpportunityInviteEmail(
      inv.invitee_email,
      inv.invitee_name,
      inv.opportunity_title,
      inv.organization_name || 'Organisation',
      inv.inviter_name || 'Un recruteur',
      inv.message,
      inv.invitation_token
    ).catch(() => {});

    res.json({ success: true, message: 'Invitation renvoyee' });
  } catch (error: any) {
    console.error('Error resending opportunity invitation:', error);
    res.status(500).json({ error: 'Erreur lors du renvoi de l\'invitation' });
  }
});

// ============================================================================
// USER INVITATION MANAGEMENT (for invitees)
// ============================================================================

/**
 * GET /api/opportunity-invitations/me - Get invitations received by current user
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
        oi.*,
        o.id as opportunity_id,
        o.title as opportunity_title,
        o.summary as opportunity_summary,
        o.cover_image_url,
        o.type as opportunity_type,
        o.location_type,
        o.locations,
        o.status as opportunity_status,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name,
        t.avatar_url as invited_by_avatar,
        json_build_object(
          'id', org.id,
          'name', org.name,
          'logo_url', org.logo_url
        ) as organization
      FROM opportunity_invitations oi
      JOIN opportunities o ON oi.opportunity_id = o.id
      JOIN talents t ON oi.invited_by = t.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE (oi.invitee_talent_id = $1 OR LOWER(oi.invitee_email) = LOWER($2))
      AND o.deleted_at IS NULL
      ORDER BY oi.created_at DESC
      LIMIT $3 OFFSET $4
    `, [talentId, userEmail, Number(limit), Number(offset)]);

    // Get count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM opportunity_invitations oi
      JOIN opportunities o ON oi.opportunity_id = o.id
      WHERE (oi.invitee_talent_id = $1 OR LOWER(oi.invitee_email) = LOWER($2))
      AND o.deleted_at IS NULL
    `, [talentId, userEmail]);

    res.json({
      data: result.rows,
      count: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error: any) {
    console.error('Error fetching user opportunity invitations:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des invitations' });
  }
});

/**
 * POST /api/opportunity-invitations/:invitationId/accept - Accept an invitation (then DELETE)
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
      SELECT oi.*, o.title as opportunity_title, o.id as opportunity_id
      FROM opportunity_invitations oi
      JOIN opportunities o ON oi.opportunity_id = o.id
      WHERE oi.id = $1
      AND (oi.invitee_talent_id = $2 OR LOWER(oi.invitee_email) = LOWER($3))
      AND o.deleted_at IS NULL
    `, [invitationId, talentId, userEmail]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      // DELETE expired invitation
      await pool.query('DELETE FROM opportunity_invitations WHERE id = $1', [invitationId]);
      return res.status(400).json({ error: 'Cette invitation a expire' });
    }

    // For opportunities, accepting means the user can now apply
    // We grant them access by deleting the invitation (they are now "invited" and can see it)

    // DELETE the invitation from DB (access granted)
    await pool.query('DELETE FROM opportunity_invitations WHERE id = $1', [invitationId]);

    res.json({
      success: true,
      message: `Invitation acceptee pour "${inv.opportunity_title}"`,
      opportunity_id: inv.opportunity_id,
    });
  } catch (error: any) {
    console.error('Error accepting opportunity invitation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation de l\'invitation' });
  }
});

/**
 * POST /api/opportunity-invitations/:invitationId/decline - Decline an invitation (DELETE)
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
      DELETE FROM opportunity_invitations
      WHERE id = $1
      AND (invitee_talent_id = $2 OR LOWER(invitee_email) = LOWER($3))
      RETURNING id
    `, [invitationId, talentId, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation non trouvee' });
    }

    res.json({ success: true, message: 'Invitation declinee' });
  } catch (error: any) {
    console.error('Error declining opportunity invitation:', error);
    res.status(500).json({ error: 'Erreur lors du refus de l\'invitation' });
  }
});

/**
 * GET /api/opportunity-invitations/token/:token - Verify invitation by token (for email links)
 */
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await pool.query(`
      SELECT
        oi.*,
        o.title as opportunity_title,
        o.summary as opportunity_summary,
        o.cover_image_url,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as invited_by_name
      FROM opportunity_invitations oi
      JOIN opportunities o ON oi.opportunity_id = o.id
      JOIN talents t ON oi.invited_by = t.id
      WHERE oi.invitation_token = $1
    `, [token]);

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation invalide ou expiree' });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await pool.query('DELETE FROM opportunity_invitations WHERE id = $1', [inv.id]);
      return res.status(400).json({ error: 'Cette invitation a expire' });
    }

    res.json({
      data: {
        id: inv.id,
        opportunity_id: inv.opportunity_id,
        opportunity_title: inv.opportunity_title,
        opportunity_summary: inv.opportunity_summary,
        cover_image_url: inv.cover_image_url,
        invited_by_name: inv.invited_by_name,
        message: inv.message,
        expires_at: inv.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Error verifying opportunity invitation token:', error);
    res.status(500).json({ error: 'Erreur lors de la verification de l\'invitation' });
  }
});

export default router;
