/**
 * OTP Service
 *
 * Email-only passwordless authentication.
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';
import { logger } from '../utils';

const APP_REVIEW_EMAIL = 'etd-app-review@etudesk.com';
const APP_REVIEW_OTP = '999999';

const OTP_CONFIG = {
  expiresInMinutes: 10,
  maxAttempts: 3,
  rateLimitMinutes: 1,
  cooldownMinutes: 30,
};

function generateOTPCode(): string {
  const min = 100000;
  const max = 999999;
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return (min + (randomBuffer[0] % (max - min + 1))).toString();
}

async function hashOTP(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

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
  retryAfter?: number;
}

export interface VerifyOTPResult {
  success: boolean;
  userId?: string;
  email?: string | null;
  isNewUser?: boolean;
  error?: string;
  attemptsRemaining?: number;
}

export async function createOTP(
  email: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<CreateOTPResult> {
  const client = await pool.connect();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const recentOTP = await client.query(
      `SELECT id, created_at FROM otp_codes
       WHERE email = $1
         AND created_at > NOW() - ($2 || ' minutes')::INTERVAL
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, OTP_CONFIG.rateLimitMinutes.toString()]
    );

    if (recentOTP.rows.length > 0) {
      const lastCreated = new Date(recentOTP.rows[0].created_at);
      const waitUntil = new Date(lastCreated.getTime() + OTP_CONFIG.rateLimitMinutes * 60 * 1000);
      return {
        success: false,
        error: 'Please wait before requesting a new code',
        rateLimited: true,
        retryAfter: Math.ceil((waitUntil.getTime() - Date.now()) / 1000),
      };
    }

    const failedAttempts = await client.query(
      `SELECT COUNT(*) as count FROM otp_codes
       WHERE email = $1
         AND attempts >= max_attempts
         AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
      [normalizedEmail, OTP_CONFIG.cooldownMinutes.toString()]
    );

    if (parseInt(failedAttempts.rows[0].count, 10) >= 1) {
      return {
        success: false,
        error: 'TOO_MANY_FAILED_ATTEMPTS',
        rateLimited: true,
        retryAfter: OTP_CONFIG.cooldownMinutes * 60,
      };
    }

    await client.query(
      `UPDATE otp_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`,
      [normalizedEmail]
    );

    const code = generateOTPCode();
    const codeHash = await hashOTP(code);
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expiresInMinutes * 60 * 1000);

    await client.query(
      `INSERT INTO otp_codes (id, email, user_id, code_hash, expires_at, ip_address, user_agent, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [otpId, normalizedEmail, userId || null, codeHash, expiresAt, ipAddress || null, userAgent || null, OTP_CONFIG.maxAttempts]
    );

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`OTP created for ${normalizedEmail} (expires: ${expiresAt.toISOString()})`);
    }

    return { success: true, code, otpId, expiresAt };
  } catch (error) {
    logger.error('Failed to create OTP:', error);
    return { success: false, error: 'Error while creating code' };
  } finally {
    client.release();
  }
}

export async function resolveOrCreateUserForGoogle(
  email: string,
  googleProfile: { name?: string; picture?: string }
): Promise<{ userId: string; email: string; isNewUser: boolean }> {
  const client = await pool.connect();
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await client.query(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query(
        `UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1`,
        [existingUser.rows[0].id]
      );
      return { userId: existingUser.rows[0].id, email: existingUser.rows[0].email, isNewUser: false };
    }

    const existingTalent = await client.query(
      `SELECT id FROM talents WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [normalizedEmail]
    );

    let talentId: string | null = existingTalent.rows[0]?.id || null;
    if (talentId) {
      const userByTalent = await client.query(
        `SELECT id, email FROM users WHERE talent_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [talentId]
      );
      if (userByTalent.rows.length > 0) {
        await client.query(
          `UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1`,
          [userByTalent.rows[0].id]
        );
        return { userId: userByTalent.rows[0].id, email: userByTalent.rows[0].email, isNewUser: false };
      }
    }

    const insertQuery = talentId
      ? `INSERT INTO users (email, email_verified, email_verified_at, talent_id) VALUES ($1, TRUE, NOW(), $2) RETURNING id, email`
      : `INSERT INTO users (email, email_verified, email_verified_at) VALUES ($1, TRUE, NOW()) RETURNING id, email`;
    const insertParams = talentId ? [normalizedEmail, talentId] : [normalizedEmail];

    const created = await client.query(insertQuery, insertParams);
    return { userId: created.rows[0].id, email: created.rows[0].email, isNewUser: true };
  } finally {
    client.release();
  }
}

export async function verifyOTP(email: string, code: string): Promise<VerifyOTPResult> {
  const client = await pool.connect();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await client.query('BEGIN');

    if (normalizedEmail === APP_REVIEW_EMAIL && code === APP_REVIEW_OTP) {
      const existingUser = await client.query(
        `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [APP_REVIEW_EMAIL]
      );

      let userId: string;
      let isNewUser = false;
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        const newUserResult = await client.query(
          `INSERT INTO users (email, email_verified, email_verified_at)
           VALUES ($1, TRUE, NOW())
           RETURNING id`,
          [APP_REVIEW_EMAIL]
        );
        userId = newUserResult.rows[0].id;
        isNewUser = true;
      }

      await client.query(
        `UPDATE users SET email_verified = TRUE, last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1`,
        [userId]
      );
      await client.query('COMMIT');
      logger.info(`App Review OTP bypass for ${APP_REVIEW_EMAIL}`);
      return { success: true, userId, email: APP_REVIEW_EMAIL, isNewUser };
    }

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
      [normalizedEmail]
    );

    if (otpResult.rows.length === 0) {
      await client.query('COMMIT');
      return { success: false, error: 'Invalid or expired code. Please request a new code.' };
    }

    const otp = otpResult.rows[0];
    const isValid = await verifyOTPHash(code, otp.code_hash);

    if (!isValid) {
      await client.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
      await client.query('COMMIT');
      const attemptsRemaining = otp.max_attempts - otp.attempts - 1;
      return {
        success: false,
        error: attemptsRemaining > 0
          ? `Incorrect code. ${attemptsRemaining} attempt(s) remaining.`
          : 'Incorrect code. Please request a new code.',
        attemptsRemaining,
      };
    }

    await client.query(`UPDATE otp_codes SET used_at = NOW() WHERE id = $1`, [otp.id]);

    let userId = otp.user_id;
    let isNewUser = false;
    let userEmail: string | null = normalizedEmail;

    if (!userId) {
      const existingUser = await client.query(
        `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        userEmail = existingUser.rows[0].email;
      } else {
        const newUserResult = await client.query(
          `INSERT INTO users (email, email_verified, email_verified_at)
           VALUES ($1, TRUE, NOW())
           RETURNING id`,
          [normalizedEmail]
        );
        userId = newUserResult.rows[0].id;
        isNewUser = true;
      }
    }

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
    logger.info(`OTP verified for ${normalizedEmail} (userId: ${userId}, isNewUser: ${isNewUser})`);

    return { success: true, userId, email: userEmail, isNewUser };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to verify OTP:', error);
    return { success: false, error: 'Error while verifying code' };
  } finally {
    client.release();
  }
}

export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    const result = await pool.query(`SELECT cleanup_expired_otps() as deleted_count`);
    const count = result.rows[0]?.deleted_count || 0;
    if (count > 0) logger.info(`Cleaned up ${count} expired OTPs`);
    return count;
  } catch (error) {
    logger.error('Failed to cleanup OTPs:', error);
    return 0;
  }
}
