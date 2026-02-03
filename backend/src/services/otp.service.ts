/**
 * OTP Service
 *
 * Handles OTP generation, storage, and verification
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';

import { logger } from '../utils';
// OTP Configuration
const OTP_CONFIG = {
  length: 6,
  expiresInMinutes: 10,
  maxAttempts: 3,
  rateLimitMinutes: 1, // Minimum time between OTP requests for same email
  cooldownMinutes: 30, // Cooldown after max attempts exceeded
};

/**
 * Generate a random 6-digit OTP code
 */
function generateOTPCode(): string {
  // Generate cryptographically secure random number
  const min = 100000;
  const max = 999999;
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const code = min + (randomBuffer[0] % (max - min + 1));
  return code.toString();
}

/**
 * Hash OTP code for secure storage
 */
async function hashOTP(code: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(code, saltRounds);
}

/**
 * Verify OTP code against hash
 */
async function verifyOTPHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export interface CreateOTPResult {
  success: boolean;
  code?: string;
  otpId?: string;
  expiresAt?: Date;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number; // seconds
}

/**
 * Create a new OTP for email
 */
export async function createOTP(
  email: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<CreateOTPResult> {
  const client = await pool.connect();

  try {
    // Check rate limiting - last OTP request for this email
    // Use parameterized interval to prevent SQL injection
    const recentOTP = await client.query(
      `SELECT id, created_at FROM otp_codes
       WHERE email = $1
         AND created_at > NOW() - ($2 || ' minutes')::INTERVAL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.toLowerCase(), OTP_CONFIG.rateLimitMinutes.toString()]
    );

    if (recentOTP.rows.length > 0) {
      const lastCreated = new Date(recentOTP.rows[0].created_at);
      const waitUntil = new Date(lastCreated.getTime() + OTP_CONFIG.rateLimitMinutes * 60 * 1000);
      const retryAfter = Math.ceil((waitUntil.getTime() - Date.now()) / 1000);

      return {
        success: false,
        error: 'Veuillez attendre avant de demander un nouveau code',
        rateLimited: true,
        retryAfter,
      };
    }

    // Check if too many failed attempts recently (cooldown)
    // Use parameterized interval to prevent SQL injection
    const failedAttempts = await client.query(
      `SELECT COUNT(*) as count FROM otp_codes
       WHERE email = $1
         AND attempts >= max_attempts
         AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
      [email.toLowerCase(), OTP_CONFIG.cooldownMinutes.toString()]
    );

    if (parseInt(failedAttempts.rows[0].count, 10) >= 3) {
      return {
        success: false,
        error: 'Trop de tentatives échouées. Veuillez réessayer plus tard.',
        rateLimited: true,
        retryAfter: OTP_CONFIG.cooldownMinutes * 60,
      };
    }

    // Invalidate all previous unused OTPs for this email
    await client.query(
      `UPDATE otp_codes
       SET used_at = NOW()
       WHERE email = $1 AND used_at IS NULL`,
      [email.toLowerCase()]
    );

    // Generate new OTP
    const code = generateOTPCode();
    const codeHash = await hashOTP(code);
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expiresInMinutes * 60 * 1000);

    // Store OTP (only hash, never store plain code)
    await client.query(
      `INSERT INTO otp_codes (id, email, user_id, code_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        otpId,
        email.toLowerCase(),
        userId || null,
        codeHash,
        expiresAt,
        ipAddress || null,
        userAgent || null,
      ]
    );

    // Only log in development, never log the actual code
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`🔑 OTP created for ${email} (expires: ${expiresAt.toISOString()})`);
    }

    return {
      success: true,
      code,
      otpId,
      expiresAt,
    };
  } catch (error) {
    logger.error('❌ Failed to create OTP:', error);
    return {
      success: false,
      error: 'Erreur lors de la création du code',
    };
  } finally {
    client.release();
  }
}

export interface VerifyOTPResult {
  success: boolean;
  userId?: string;
  email?: string;
  isNewUser?: boolean;
  error?: string;
  attemptsRemaining?: number;
}

/**
 * Verify an OTP code
 */
export async function verifyOTP(email: string, code: string): Promise<VerifyOTPResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find valid OTP for this email
    const otpResult = await client.query(
      `SELECT id, code_hash, user_id, attempts, max_attempts
       FROM otp_codes
       WHERE email = $1
         AND used_at IS NULL
         AND expires_at > NOW()
         AND attempts < max_attempts
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [email.toLowerCase()]
    );

    if (otpResult.rows.length === 0) {
      await client.query('COMMIT');
      return {
        success: false,
        error: 'Code invalide ou expiré. Veuillez demander un nouveau code.',
      };
    }

    const otp = otpResult.rows[0];

    // Verify the code
    const isValid = await verifyOTPHash(code, otp.code_hash);

    if (!isValid) {
      // Increment attempts
      await client.query(
        `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`,
        [otp.id]
      );
      await client.query('COMMIT');

      const attemptsRemaining = otp.max_attempts - otp.attempts - 1;

      return {
        success: false,
        error: attemptsRemaining > 0
          ? `Code incorrect. ${attemptsRemaining} tentative(s) restante(s).`
          : 'Code incorrect. Veuillez demander un nouveau code.',
        attemptsRemaining,
      };
    }

    // Mark OTP as used
    await client.query(
      `UPDATE otp_codes SET used_at = NOW() WHERE id = $1`,
      [otp.id]
    );

    // Check if user exists
    let userId = otp.user_id;
    let isNewUser = false;

    if (!userId) {
      // Check if user already exists with this email
      const existingUser = await client.query(
        `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        // Create new user
        const newUserResult = await client.query(
          `INSERT INTO users (email, email_verified, email_verified_at)
           VALUES ($1, TRUE, NOW())
           RETURNING id`,
          [email.toLowerCase()]
        );
        userId = newUserResult.rows[0].id;
        isNewUser = true;
      }
    }

    // Update user's email verification and last login
    await client.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW()),
           last_login_at = NOW(),
           login_count = login_count + 1
       WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    logger.info(`✅ OTP verified for ${email} (userId: ${userId}, isNewUser: ${isNewUser})`);

    return {
      success: true,
      userId,
      email: email.toLowerCase(),
      isNewUser,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to verify OTP:', error);
    return {
      success: false,
      error: 'Erreur lors de la vérification du code',
    };
  } finally {
    client.release();
  }
}

/**
 * Cleanup expired OTPs (call periodically)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    const result = await pool.query(`SELECT cleanup_expired_otps() as deleted_count`);
    const count = result.rows[0]?.deleted_count || 0;
    if (count > 0) {
      logger.info(`🧹 Cleaned up ${count} expired OTPs`);
    }
    return count;
  } catch (error) {
    logger.error('❌ Failed to cleanup OTPs:', error);
    return 0;
  }
}
