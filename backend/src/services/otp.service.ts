/**
 * OTP Service
 *
 * Handles OTP generation, storage, and verification
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';
import { formatPhoneToE164 } from './whatsapp.service';

import { logger } from '../utils';

// Apple App Store Review test account — fixed OTP bypass
const APP_REVIEW_EMAIL = 'etd-app-review@etudesk.com';
const APP_REVIEW_OTP = '999999';

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

type OTPChannel = 'email' | 'whatsapp';

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
        error: 'TOO_MANY_FAILED_ATTEMPTS',
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

/**
 * Create a new OTP for WhatsApp phone login
 */
export async function createWhatsAppOTP(
  phone: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<CreateOTPResult> {
  const formattedPhone = formatPhoneToE164(phone);

  if (!formattedPhone) {
    return {
      success: false,
      error: 'Numéro de téléphone invalide',
    };
  }

  // If the phone is already linked to an existing talent/user, attach that userId to the OTP.
  // This prevents accidental creation of a new user on verification.
  if (!userId) {
    const client = await pool.connect();
    try {
      const existing = await findExistingUserByWhatsAppPhone(client, formattedPhone);
      userId = existing?.userId;
    } catch (err) {
      logger.warn('Failed to pre-resolve userId for WhatsApp OTP (continuing)', { err });
    } finally {
      client.release();
    }
  }

  return createOTP(formattedPhone, userId, ipAddress, userAgent);
}

export interface VerifyOTPResult {
  success: boolean;
  userId?: string;
  email?: string;
  isNewUser?: boolean;
  error?: string;
  attemptsRemaining?: number;
}

function normalizeIdentifier(identifier: string, channel: OTPChannel): string | null {
  if (channel === 'email') {
    return identifier.toLowerCase().trim();
  }

  return formatPhoneToE164(identifier);
}

function buildPlaceholderEmailForPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `wa_${digits}@etudesk.local`;
}

function getPhoneDigitsCandidates(phoneE164: string): string[] {
  const digits = phoneE164.replace(/[^\d]/g, '');
  const set = new Set<string>();
  if (digits) set.add(digits);

  // Also match national format in DB if it was stored without country code.
  // UEMOA country codes (can be extended later).
  const countryCodes = ['221', '223', '225', '226', '227', '228', '229', '245'];
  for (const cc of countryCodes) {
    if (digits.startsWith(cc) && digits.length > cc.length) {
      set.add(digits.slice(cc.length));
    }
  }

  return Array.from(set);
}

async function findExistingTalentByPhoneDigits(client: any, phoneE164: string): Promise<{ talentId: string; talentEmail: string } | null> {
  const candidates = getPhoneDigitsCandidates(phoneE164);
  const res = await client.query(
    `SELECT id, email
     FROM talents
     WHERE deleted_at IS NULL
       AND phone IS NOT NULL
       AND regexp_replace(phone, '[^0-9]', '', 'g') = ANY($1::text[])
     ORDER BY updated_at DESC
     LIMIT 1`,
    [candidates]
  );

  if (!res.rows.length) return null;
  return { talentId: res.rows[0].id, talentEmail: res.rows[0].email };
}

async function findExistingUserByWhatsAppPhone(client: any, phoneE164: string): Promise<{ userId: string; email: string } | null> {
  const candidates = getPhoneDigitsCandidates(phoneE164);
  const placeholderEmail = buildPlaceholderEmailForPhone(phoneE164);

  const res = await client.query(
    `SELECT u.id, u.email
     FROM users u
     LEFT JOIN talents t ON t.id = u.talent_id
     WHERE u.deleted_at IS NULL
       AND (
         (t.deleted_at IS NULL AND t.phone IS NOT NULL AND regexp_replace(t.phone, '[^0-9]', '', 'g') = ANY($1::text[]))
         OR u.email = $2
       )
     ORDER BY (u.talent_id IS NOT NULL) DESC, u.created_at DESC
     LIMIT 1`,
    [candidates, placeholderEmail]
  );

  if (!res.rows.length) return null;
  return { userId: res.rows[0].id, email: res.rows[0].email };
}

async function resolveOrCreateUserForWhatsAppPhone(
  client: any,
  phoneE164: string
): Promise<{ userId: string; email: string; isNewUser: boolean }> {
  // 1) Existing user found by linked talent phone or placeholder email
  const existingUser = await findExistingUserByWhatsAppPhone(client, phoneE164);
  if (existingUser) {
    return { userId: existingUser.userId, email: existingUser.email, isNewUser: false };
  }

  // 2) Talent exists for this phone -> ensure a user exists and is linked to that talent
  const talent = await findExistingTalentByPhoneDigits(client, phoneE164);
  if (talent) {
    const byTalentId = await client.query(
      `SELECT id, email FROM users WHERE talent_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [talent.talentId]
    );
    if (byTalentId.rows.length) {
      return { userId: byTalentId.rows[0].id, email: byTalentId.rows[0].email, isNewUser: false };
    }

    const byTalentEmail = await client.query(
      `SELECT id, email, talent_id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [talent.talentEmail]
    );
    if (byTalentEmail.rows.length) {
      const u = byTalentEmail.rows[0];
      if (!u.talent_id) {
        await client.query(`UPDATE users SET talent_id = $1 WHERE id = $2`, [talent.talentId, u.id]);
      }
      return { userId: u.id, email: u.email, isNewUser: false };
    }

    // Create user using the talent email and link to the existing talent.
    const created = await client.query(
      `INSERT INTO users (email, email_verified, email_verified_at, talent_id)
       VALUES ($1, TRUE, NOW(), $2)
       RETURNING id, email`,
      [talent.talentEmail, talent.talentId]
    );
    return { userId: created.rows[0].id, email: created.rows[0].email, isNewUser: false };
  }

  // 3) No talent exists -> create a minimal user (onboarding will create talent later).
  const placeholderEmail = buildPlaceholderEmailForPhone(phoneE164);
  const created = await client.query(
    `INSERT INTO users (email, email_verified, email_verified_at)
     VALUES ($1, TRUE, NOW())
     RETURNING id, email`,
    [placeholderEmail]
  );
  return { userId: created.rows[0].id, email: created.rows[0].email, isNewUser: true };
}

/**
 * Resolve or create a user for Google OAuth sign-in.
 * Looks up user by email (already unique in DB). If not found, creates one.
 */
export async function resolveOrCreateUserForGoogle(
  email: string,
  googleProfile: { name?: string; picture?: string }
): Promise<{ userId: string; email: string; isNewUser: boolean }> {
  const client = await pool.connect();
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists by email
    const existingUser = await client.query(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      // Update last login
      await client.query(
        `UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1`,
        [existingUser.rows[0].id]
      );
      return { userId: existingUser.rows[0].id, email: existingUser.rows[0].email, isNewUser: false };
    }

    // Check if a talent exists with this email → link it
    const existingTalent = await client.query(
      `SELECT id FROM talents WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [normalizedEmail]
    );

    let talentId: string | null = null;
    if (existingTalent.rows.length > 0) {
      talentId = existingTalent.rows[0].id;

      // Check if a user is already linked to this talent
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

    // Create new user
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

/**
 * Verify an OTP code
 */
export async function verifyOTP(email: string, code: string): Promise<VerifyOTPResult> {
  return verifyOTPByChannel(email, code, 'email');
}

/**
 * Verify an OTP code for email or WhatsApp identifier.
 */
export async function verifyOTPByChannel(
  identifier: string,
  code: string,
  channel: OTPChannel
): Promise<VerifyOTPResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const normalizedIdentifier = normalizeIdentifier(identifier, channel);

    if (!normalizedIdentifier) {
      await client.query('COMMIT');
      return {
        success: false,
        error: 'Identifiant invalide',
      };
    }

    // Apple App Store Review bypass — fixed OTP for test account
    if (normalizedIdentifier === APP_REVIEW_EMAIL && code === APP_REVIEW_OTP) {
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
      logger.info(`✅ App Review OTP bypass for ${APP_REVIEW_EMAIL}`);
      return { success: true, userId, email: APP_REVIEW_EMAIL, isNewUser };
    }

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
      [normalizedIdentifier]
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
    let userEmail = channel === 'email'
      ? normalizedIdentifier
      : buildPlaceholderEmailForPhone(normalizedIdentifier);

    if (!userId) {
      if (channel === 'email') {
        const existingUser = await client.query(
          `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
          [normalizedIdentifier]
        );

        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
          userEmail = existingUser.rows[0].email;
        } else {
          const newUserResult = await client.query(
            `INSERT INTO users (email, email_verified, email_verified_at)
             VALUES ($1, TRUE, NOW())
             RETURNING id`,
            [normalizedIdentifier]
          );
          userId = newUserResult.rows[0].id;
          userEmail = normalizedIdentifier;
          isNewUser = true;
        }
      } else {
        const resolved = await resolveOrCreateUserForWhatsAppPhone(client, normalizedIdentifier);
        userId = resolved.userId;
        userEmail = resolved.email;
        isNewUser = resolved.isNewUser;
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

    logger.info(`✅ OTP verified for ${normalizedIdentifier} (userId: ${userId}, isNewUser: ${isNewUser}, channel: ${channel})`);

    return {
      success: true,
      userId,
      email: userEmail,
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
