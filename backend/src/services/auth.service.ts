/**
 * Auth Service
 *
 * Handles JWT tokens, sessions, and user authentication
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';
import { deletePineconeVector } from './embedding.service';

import { logger } from '../utils';
import { i18next } from '../i18n';
// JWT Configuration
const getJwtSecret = (envVar: string, name: string): string => {
  const secret = process.env[envVar];
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be set in production environment`);
    }
    // Dev-only fallback with warning
    logger.warn(`⚠️ ${name} not set. Using development fallback. DO NOT USE IN PRODUCTION.`);
    return `dev-only-${name.toLowerCase().replace(/_/g, '-')}-${Date.now()}`;
  }
  if (secret.length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
  return secret;
};

const JWT_CONFIG = {
  accessTokenSecret: getJwtSecret('JWT_ACCESS_SECRET', 'JWT_ACCESS_SECRET'),
  refreshTokenSecret: getJwtSecret('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET'),
  accessTokenExpiry: '2h',
  refreshTokenExpiry: '30d',
};

export interface TokenPayload {
  userId: string;
  email: string | null;
  talentId?: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  talentId: string | null;
  hasTalentProfile: boolean;
  // Flattened talent data for mobile app
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  talent?: {
    id: string;
    slug: string;
    displayName: string;
    avatarUrl: string | null;
    gender?: string | null;
  };
  gender?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Generate access and refresh tokens
 */
export function generateTokens(userId: string, email: string | null, talentId?: string): AuthTokens {
  const accessPayload: TokenPayload = {
    userId,
    email,
    talentId,
    type: 'access',
  };

  const refreshPayload: TokenPayload = {
    userId,
    email,
    talentId,
    type: 'refresh',
  };

  const accessOptions: SignOptions = { expiresIn: JWT_CONFIG.accessTokenExpiry as jwt.SignOptions['expiresIn'] };
  const accessToken = jwt.sign(accessPayload, JWT_CONFIG.accessTokenSecret, accessOptions);

  const refreshOptions: SignOptions = { expiresIn: JWT_CONFIG.refreshTokenExpiry as jwt.SignOptions['expiresIn'] };
  const refreshToken = jwt.sign(refreshPayload, JWT_CONFIG.refreshTokenSecret, refreshOptions);

  return {
    accessToken,
    refreshToken,
    expiresIn: 2 * 60 * 60, // 2 hours in seconds
  };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessTokenSecret) as TokenPayload;
    if (payload.type !== 'access') {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_CONFIG.refreshTokenSecret) as TokenPayload;
    if (payload.type !== 'refresh') {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  refreshToken: string,
  deviceInfo?: {
    deviceName?: string;
    deviceType?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string> {
  const sessionId = uuidv4();
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, device_name, device_type, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      sessionId,
      userId,
      refreshTokenHash,
      deviceInfo?.deviceName || null,
      deviceInfo?.deviceType || null,
      deviceInfo?.ipAddress || null,
      deviceInfo?.userAgent || null,
      expiresAt,
    ]
  );

  return sessionId;
}

/**
 * Validate session and refresh token
 */
export async function validateSession(refreshToken: string): Promise<{ valid: boolean; userId?: string; sessionId?: string }> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return { valid: false };
    }

    // Find active sessions for this user
    const result = await pool.query(
      `SELECT id, refresh_token_hash FROM sessions
       WHERE user_id = $1
         AND is_active = TRUE
         AND expires_at > NOW()`,
      [payload.userId]
    );

    for (const session of result.rows) {
      const isMatch = await bcrypt.compare(refreshToken, session.refresh_token_hash);
      if (isMatch) {
        // Update last used
        await pool.query(
          `UPDATE sessions SET last_used_at = NOW() WHERE id = $1`,
          [session.id]
        );

        return {
          valid: true,
          userId: payload.userId,
          sessionId: session.id,
        };
      }
    }

    return { valid: false };
  } catch (error) {
    logger.error('❌ Session validation error:', error);
    return { valid: false };
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, reason?: string): Promise<boolean> {
  try {
    await pool.query(
      `UPDATE sessions
       SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $2
       WHERE id = $1`,
      [sessionId, reason || 'USER_LOGOUT']
    );
    return true;
  } catch (error) {
    logger.error('❌ Failed to revoke session:', error);
    return false;
  }
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId: string, reason?: string): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE sessions
       SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $2
       WHERE user_id = $1 AND is_active = TRUE
       RETURNING id`,
      [userId, reason || 'USER_LOGOUT_ALL']
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('❌ Failed to revoke all sessions:', error);
    return 0;
  }
}

/**
 * Refresh tokens
 */
export async function refreshTokens(refreshToken: string): Promise<{ success: boolean; tokens?: AuthTokens; error?: string }> {
  const validation = await validateSession(refreshToken);

  if (!validation.valid || !validation.userId) {
    return { success: false, error: i18next.t('auth:invalidSession') };
  }

  // Get user info
  const userResult = await pool.query(
     `SELECT u.id, u.email, u.talent_id, t.slug as talent_slug
     FROM users u
     LEFT JOIN talents t ON u.talent_id = t.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [validation.userId]
  );

  if (userResult.rows.length === 0) {
    return { success: false, error: i18next.t('auth:userNotFound') };
  }

  const user = userResult.rows[0];

  // Generate new tokens (this will include the latest talent_id from DB)
  const tokens = generateTokens(user.id, user.email, user.talent_id);

  // Update session with new refresh token
  const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
  await pool.query(
    `UPDATE sessions
     SET refresh_token_hash = $1, last_used_at = NOW()
     WHERE id = $2`,
    [newRefreshTokenHash, validation.sessionId]
  );

  return { success: true, tokens };
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         COALESCE(NULLIF(t.email, ''), NULLIF(u.email, '')) as email,
         u.email_verified,
         u.phone as user_phone,
         u.talent_id,
         u.created_at,
         u.last_login_at,
         t.id as talent_id,
         t.slug as talent_slug,
         t.first_name,
         t.last_name,
         t.gender,
         t.phone as talent_phone,
         COALESCE(NULLIF(CONCAT_WS(' ', t.first_name, t.last_name), ''), NULLIF(t.email, ''), NULLIF(u.email, ''), NULLIF(u.phone, '')) as talent_display_name,
         t.avatar_url as talent_avatar_url
       FROM users u
       LEFT JOIN talents t ON u.talent_id = t.id AND t.deleted_at IS NULL
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      phone: row.talent_phone || row.user_phone || null,
      emailVerified: row.email_verified,
      talentId: row.talent_id,
      hasTalentProfile: !!row.talent_id,
      // Flatten talent data to top level for mobile app
      displayName: row.talent_display_name || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      avatarUrl: row.talent_avatar_url || null,
      gender: row.gender || null,
      talent: row.talent_id ? {
        id: row.talent_id,
        slug: row.talent_slug,
        displayName: row.talent_display_name,
        avatarUrl: row.talent_avatar_url,
        gender: row.gender || null,
      } : undefined,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  } catch (error) {
    logger.error('❌ Failed to get user profile:', error);
    return null;
  }
}

/**
 * Deactivate all push tokens for a talent
 */
export async function deactivateAllPushTokens(talentId: string): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE push_tokens SET is_active = false, updated_at = NOW()
       WHERE talent_id = $1 AND is_active = true`,
      [talentId]
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('❌ Failed to deactivate push tokens:', error);
    return 0;
  }
}

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  code?: 'USER_NOT_FOUND' | 'ORG_SOLE_ADMIN_WITH_MEMBERS' | 'INTERNAL_ERROR';
  blockedOrganizations?: Array<{ id: string; name: string; memberCount: number }>;
}

/**
 * Delete a user account — full cascade with org cleanup, data anonymization, and Pinecone cleanup
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Phase A — Vérifications ──

    // A1: Get talent_id
    const userRes = await client.query(
      `SELECT talent_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, code: 'USER_NOT_FOUND', error: i18next.t('auth:userNotFound') };
    }
    const talentId: string | null = userRes.rows[0].talent_id;

    // A2: List orgs where talent is a member
    let orgMemberships: Array<{ organization_id: string; role: string; name: string }> = [];
    if (talentId) {
      const orgRes = await client.query(
        `SELECT om.organization_id, om.role, o.name
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.talent_id = $1 AND om.status = 'ACTIVE' AND o.deleted_at IS NULL`,
        [talentId]
      );
      orgMemberships = orgRes.rows;
    }

    // A3-A5: Check sole admin orgs
    const orgsToDelete: string[] = [];
    const orgsToLeave: string[] = [];
    const blockedOrganizations: Array<{ id: string; name: string; memberCount: number }> = [];

    for (const membership of orgMemberships) {
      if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
        // Count other admins
        const otherAdmins = await client.query(
          `SELECT COUNT(*) as count FROM organization_members
           WHERE organization_id = $1 AND talent_id != $2 AND role IN ('OWNER', 'ADMIN') AND status = 'ACTIVE'`,
          [membership.organization_id, talentId]
        );
        const hasOtherAdmins = parseInt(otherAdmins.rows[0].count) > 0;

        if (!hasOtherAdmins) {
          // Count other active members
          const otherMembers = await client.query(
            `SELECT COUNT(*) as count FROM organization_members
             WHERE organization_id = $1 AND talent_id != $2 AND status = 'ACTIVE'`,
            [membership.organization_id, talentId]
          );
          const memberCount = parseInt(otherMembers.rows[0].count);

          if (memberCount > 0) {
            blockedOrganizations.push({
              id: membership.organization_id,
              name: membership.name,
              memberCount,
            });
          } else {
            orgsToDelete.push(membership.organization_id);
          }
        } else {
          orgsToLeave.push(membership.organization_id);
        }
      } else {
        orgsToLeave.push(membership.organization_id);
      }
    }

    // A5: Block if sole admin with members
    if (blockedOrganizations.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        code: 'ORG_SOLE_ADMIN_WITH_MEMBERS',
        error: i18next.t('auth:orgSoleAdminWithMembers'),
        blockedOrganizations,
      };
    }

    // ── Phase B — Cleanup organisations ──

    // Track deleted opportunities for Pinecone cleanup
    const deletedOpportunityIds: string[] = [];

    // B: Delete orgs where sole admin and 0 other members
    for (const orgId of orgsToDelete) {
      // Collect opportunity IDs for Pinecone
      const oppRes = await client.query(
        `SELECT id FROM opportunities WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      deletedOpportunityIds.push(...oppRes.rows.map((r: { id: string }) => r.id));

      // B1: Soft-delete opportunities
      await client.query(
        `UPDATE opportunities SET deleted_at = NOW() WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      // B2: Cancel bookings BEFORE spaces (RESTRICT)
      await client.query(
        `UPDATE space_bookings SET status = 'CANCELLED', updated_at = NOW()
         WHERE organization_id = $1 AND status IN ('CONFIRMED', 'PENDING')`,
        [orgId]
      );
      // B3: Soft-delete spaces
      await client.query(
        `UPDATE spaces SET deleted_at = NOW() WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      // B4: Soft-delete org documents
      await client.query(
        `UPDATE organization_documents SET deleted_at = NOW() WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );
      // B5: Detach communities
      await client.query(
        `UPDATE communities SET organization_id = NULL WHERE organization_id = $1`,
        [orgId]
      );
      // B6: Delete tag definitions (cascades to assignments)
      await client.query(
        `DELETE FROM organization_talent_tag_definitions WHERE organization_id = $1`,
        [orgId]
      );
      // B7: Delete favorites
      await client.query(
        `DELETE FROM organization_talent_favorites WHERE organization_id = $1`,
        [orgId]
      );
      // B8: Delete org invitations
      await client.query(
        `DELETE FROM organization_invitations WHERE organization_id = $1`,
        [orgId]
      );
      // B9: Delete all members
      await client.query(
        `DELETE FROM organization_members WHERE organization_id = $1`,
        [orgId]
      );
      // B10: Soft-delete org
      await client.query(
        `UPDATE organizations SET deleted_at = NOW() WHERE id = $1`,
        [orgId]
      );
    }

    // B11: Leave orgs where other admins exist or simple member
    for (const orgId of orgsToLeave) {
      await client.query(
        `DELETE FROM organization_members WHERE talent_id = $1 AND organization_id = $2`,
        [talentId, orgId]
      );
    }

    // ── Phase C — Cleanup données talent ──

    // C1: Revoke sessions
    await client.query(
      `UPDATE sessions SET is_active = FALSE, revoked_at = NOW(), revoked_reason = 'ACCOUNT_DELETED'
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (talentId) {
      // C2: Deactivate push tokens
      await client.query(
        `UPDATE push_tokens SET is_active = false, updated_at = NOW() WHERE talent_id = $1`,
        [talentId]
      );
      // C3: Soft-delete documents
      await client.query(
        `UPDATE talent_documents SET deleted_at = NOW() WHERE talent_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C4: Soft-delete community memberships
      await client.query(
        `UPDATE community_members SET deleted_at = NOW() WHERE talent_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C5: Soft-delete community activities
      await client.query(
        `UPDATE community_activities SET deleted_at = NOW() WHERE author_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C6: Soft-delete community comments
      await client.query(
        `UPDATE community_activity_comments SET deleted_at = NOW() WHERE author_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C7: Soft-delete applications
      await client.query(
        `UPDATE opportunity_applications SET deleted_at = NOW() WHERE talent_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C8: Soft-delete copilot sessions
      await client.query(
        `UPDATE copilot_sessions SET deleted_at = NOW() WHERE talent_id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
      // C9: Anonymize copilot traces
      await client.query(
        `UPDATE copilot_traces SET talent_id = NULL WHERE talent_id = $1`,
        [talentId]
      );
      // C10: Hard-delete skills
      await client.query(`DELETE FROM talent_skills WHERE talent_id = $1`, [talentId]);
      // C11-C13: Hard-delete community interactions
      await client.query(`DELETE FROM community_activity_reactions WHERE user_id = $1`, [talentId]);
      await client.query(`DELETE FROM community_activity_bookmarks WHERE user_id = $1`, [talentId]);
      await client.query(`DELETE FROM community_poll_votes WHERE user_id = $1`, [talentId]);
      // C14-C16: Hard-delete subscriptions, invitations, notifications
      await client.query(`DELETE FROM community_subscriptions WHERE talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM community_invitations WHERE invited_by = $1 OR invitee_talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM community_notifications WHERE talent_id = $1`, [talentId]);
      // C17-C19: Hard-delete opportunity bookmarks, posters, invitations
      await client.query(`DELETE FROM opportunity_bookmarks WHERE talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM opportunity_posters WHERE poster_talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM opportunity_invitations WHERE invited_by = $1 OR invitee_talent_id = $1`, [talentId]);
      // C20: Hard-delete space invitations
      await client.query(`DELETE FROM space_invitations WHERE invited_by = $1 OR invitee_talent_id = $1`, [talentId]);
      // C21: Cancel future space bookings
      await client.query(
        `UPDATE space_bookings SET status = 'CANCELLED', updated_at = NOW()
         WHERE talent_id = $1 AND status IN ('CONFIRMED', 'PENDING') AND end_time > NOW()`,
        [talentId]
      );
      // C22-C23: Hard-delete connections and recommendations
      await client.query(`DELETE FROM connections WHERE from_talent_id = $1 OR to_talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM recommendations WHERE recommender_id = $1 OR recommended_id = $1`, [talentId]);
      // C24-C25: Hard-delete notification preferences and notifications
      await client.query(`DELETE FROM notification_preferences WHERE talent_id = $1`, [talentId]);
      await client.query(`DELETE FROM notifications WHERE talent_id = $1`, [talentId]);
      // C26: Hard-delete org invitations sent by talent
      await client.query(`DELETE FROM organization_invitations WHERE invited_by = $1`, [talentId]);
      // C27: Hard-delete org tag assignments
      await client.query(`DELETE FROM organization_talent_tag_assignments WHERE talent_id = $1`, [talentId]);

      // C28-C31: SET NULL for created_by/uploaded_by/actor_id/favorited_by
      await client.query(`UPDATE communities SET created_by = NULL WHERE created_by = $1`, [talentId]);
      await client.query(`UPDATE organization_documents SET uploaded_by = NULL WHERE uploaded_by = $1`, [talentId]);
      await client.query(`UPDATE organization_talent_favorites SET favorited_by = NULL WHERE favorited_by = $1`, [talentId]);
      await client.query(`UPDATE community_notifications SET actor_id = NULL WHERE actor_id = $1`, [talentId]);
    }

    // ── Phase D — Soft-delete core ──

    if (talentId) {
      await client.query(
        `UPDATE talents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [talentId]
      );
    }
    await client.query(
      `UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');
    logger.info(`Account deleted for user ${userId} (talent: ${talentId})`);

    // ── Phase E — Post-transaction cleanup (fire-and-forget) ──

    if (talentId) {
      deletePineconeVector('talent', talentId).catch(err =>
        logger.warn('Failed to delete talent Pinecone vector', { talentId, error: err })
      );
    }
    for (const orgId of orgsToDelete) {
      deletePineconeVector('organization', orgId).catch(err =>
        logger.warn('Failed to delete org Pinecone vector', { orgId, error: err })
      );
    }
    for (const oppId of deletedOpportunityIds) {
      deletePineconeVector('opportunity', oppId).catch(err =>
        logger.warn('Failed to delete opportunity Pinecone vector', { oppId, error: err })
      );
    }

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to delete account:', error);
    return { success: false, code: 'INTERNAL_ERROR', error: i18next.t('auth:accountDeleteInternalError') };
  } finally {
    client.release();
  }
}

/**
 * Cleanup expired sessions (housekeeping)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE expires_at < NOW() AND is_active = FALSE`
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('❌ Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Check if user needs onboarding (no talent profile)
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT talent_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return result.rows.length > 0 && !result.rows[0].talent_id;
  } catch (error) {
    logger.error('❌ Failed to check onboarding status:', error);
    return false;
  }
}
