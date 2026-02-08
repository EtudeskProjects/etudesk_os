/**
 * Auth Service
 *
 * Handles JWT tokens, sessions, and user authentication
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';

import { logger } from '../utils';
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
  email: string;
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
  email: string;
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
export function generateTokens(userId: string, email: string, talentId?: string): AuthTokens {
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
    return { success: false, error: 'Session invalide ou expirée' };
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
    return { success: false, error: 'Utilisateur non trouvé' };
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
         u.email,
         u.email_verified,
         u.talent_id,
         u.created_at,
         u.last_login_at,
         t.id as talent_id,
         t.slug as talent_slug,
         t.first_name,
         t.last_name,
         t.gender,
         COALESCE(NULLIF(CONCAT_WS(' ', t.first_name, t.last_name), ''), u.email) as talent_display_name,
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
