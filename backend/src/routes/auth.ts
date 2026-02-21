/**
 * Auth Routes
 *
 * OTP Passwordless Authentication
 */

import { Router, Request, Response } from 'express';
import { createOTP, createWhatsAppOTP, verifyOTP, verifyOTPByChannel, resolveOrCreateUserForGoogle } from '../services/otp.service';
import { sendOTPEmail } from '../services/email.service';
import { sendWhatsAppOtp, formatPhoneToE164 } from '../services/whatsapp.service';
import {
  generateTokens,
  createSession,
  validateSession,
  refreshTokens,
  revokeSession,
  revokeAllSessions,
  getUserProfile,
  needsOnboarding,
  deactivateAllPushTokens,
  deleteAccount,
} from '../services/auth.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import { logger } from '../utils';
import {
  validate,
  requestOtpSchema,
  requestWhatsAppOtpSchema,
  verifyOtpSchema,
  verifyWhatsAppOtpSchema,
  refreshTokenSchema,
  googleAuthSchema,
} from '../middleware/validation.middleware';

const router = Router();

/**
 * POST /auth/request-otp
 *
 * Request an OTP code to be sent to email
 */
router.post('/request-otp', validate(requestOtpSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body; // Already validated and transformed by Zod

    // Get client info for security
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create OTP
    const otpResult = await createOTP(
      email,
      undefined,
      ipAddress,
      userAgent
    );

    if (!otpResult.success) {
      const status = otpResult.rateLimited ? 429 : 400;
      return res.status(status).json({
        success: false,
        error: otpResult.error,
        retryAfter: otpResult.retryAfter,
      });
    }

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otpResult.code!);

    if (!emailResult.success) {
      logger.error('❌ Failed to send OTP email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: req.t('auth:otpEmailFailed'),
      });
    }

    return res.json({
      success: true,
      message: req.t('auth:otpSent'),
      expiresAt: otpResult.expiresAt,
    });
  } catch (error) {
    logger.error('❌ Request OTP error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/request-whatsapp-otp
 *
 * Request an OTP code to be sent on WhatsApp
 */
router.post('/request-whatsapp-otp', validate(requestWhatsAppOtpSchema), async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const otpResult = await createWhatsAppOTP(phone, undefined, ipAddress, userAgent);

    if (!otpResult.success) {
      const status = otpResult.rateLimited ? 429 : 400;
      return res.status(status).json({
        success: false,
        error: otpResult.error,
        retryAfter: otpResult.retryAfter,
      });
    }

    const formattedPhone = formatPhoneToE164(phone);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: req.t('auth:invalidPhone'),
      });
    }

    const waResult = await sendWhatsAppOtp(formattedPhone, otpResult.code!);
    if (!waResult.success) {
      logger.error('❌ Failed to send WhatsApp OTP:', waResult.error);
      return res.status(500).json({
        success: false,
        error: req.t('auth:otpWhatsAppFailed'),
      });
    }

    return res.json({
      success: true,
      message: req.t('auth:otpWhatsAppSent'),
      expiresAt: otpResult.expiresAt,
    });
  } catch (error) {
    logger.error('❌ Request WhatsApp OTP error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/verify-otp
 *
 * Verify OTP and create session
 */
router.post('/verify-otp', validate(verifyOtpSchema), auditLog('AUTH_VERIFY_OTP'), async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body; // Already validated by Zod

    // Verify OTP
    const verifyResult = await verifyOTP(email, code);

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: verifyResult.error,
        attemptsRemaining: verifyResult.attemptsRemaining,
      });
    }

    // Generate tokens
    const tokens = generateTokens(verifyResult.userId!, verifyResult.email!);

    // Create session
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await createSession(verifyResult.userId!, tokens.refreshToken, {
      ipAddress,
      userAgent,
      deviceType: detectDeviceType(userAgent),
    });

    // Check if user needs onboarding
    const needsOnboard = verifyResult.isNewUser || await needsOnboarding(verifyResult.userId!);

    // Get user profile
    const profile = await getUserProfile(verifyResult.userId!);

    return res.json({
      success: true,
      message: verifyResult.isNewUser ? req.t('auth:accountCreated') : req.t('auth:loginSuccess'),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: profile,
      isNewUser: verifyResult.isNewUser,
      needsOnboarding: needsOnboard,
    });
  } catch (error) {
    logger.error('❌ Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/verify-whatsapp-otp
 *
 * Verify WhatsApp OTP and create session
 */
router.post('/verify-whatsapp-otp', validate(verifyWhatsAppOtpSchema), auditLog('AUTH_VERIFY_WHATSAPP_OTP'), async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;

    const verifyResult = await verifyOTPByChannel(phone, code, 'whatsapp');

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: verifyResult.error,
        attemptsRemaining: verifyResult.attemptsRemaining,
      });
    }

    const tokens = generateTokens(verifyResult.userId!, verifyResult.email!);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await createSession(verifyResult.userId!, tokens.refreshToken, {
      ipAddress,
      userAgent,
      deviceType: detectDeviceType(userAgent),
    });

    const needsOnboard = verifyResult.isNewUser || await needsOnboarding(verifyResult.userId!);
    const profile = await getUserProfile(verifyResult.userId!);

    return res.json({
      success: true,
      message: verifyResult.isNewUser ? req.t('auth:accountCreated') : req.t('auth:loginSuccess'),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: profile,
      isNewUser: verifyResult.isNewUser,
      needsOnboarding: needsOnboard,
    });
  } catch (error) {
    logger.error('❌ Verify WhatsApp OTP error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/google
 *
 * Authenticate with Google OAuth ID token
 */
router.post('/google', validate(googleAuthSchema), auditLog('AUTH_GOOGLE'), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Verify the Google ID token
    const { OAuth2Client } = await import('google-auth-library');
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      logger.warn('Google ID token verification failed', { error: verifyError });
      return res.status(401).json({
        success: false,
        error: req.t('auth:googleTokenInvalid'),
      });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        error: req.t('auth:googleTokenPayloadInvalid'),
      });
    }

    const { email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(401).json({
        success: false,
        error: req.t('auth:googleEmailNotVerified'),
      });
    }

    // Resolve or create user
    const result = await resolveOrCreateUserForGoogle(email, { name, picture });

    // Generate tokens
    const tokens = generateTokens(result.userId, result.email);

    // Create session
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await createSession(result.userId, tokens.refreshToken, {
      ipAddress,
      userAgent,
      deviceType: detectDeviceType(userAgent),
    });

    // Check if user needs onboarding
    const needsOnboard = result.isNewUser || await needsOnboarding(result.userId);

    // Get user profile
    const profile = await getUserProfile(result.userId);

    return res.json({
      success: true,
      message: result.isNewUser ? req.t('auth:accountCreated') : req.t('auth:loginSuccess'),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      user: profile,
      isNewUser: result.isNewUser,
      needsOnboarding: needsOnboard,
    });
  } catch (error) {
    logger.error('❌ Google auth error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/refresh
 *
 * Refresh access token using refresh token
 */
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body; // Already validated by Zod

    const result = await refreshTokens(refreshToken);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      tokens: result.tokens,
    });
  } catch (error) {
    logger.error('❌ Refresh token error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * POST /auth/logout
 *
 * Logout current session
 */
router.post('/logout', authMiddleware, auditLog('AUTH_LOGOUT'), async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken, allDevices } = req.body;

    // Deactivate push tokens for this user's talent
    if (req.talentId) {
      await deactivateAllPushTokens(req.talentId).catch(err =>
        logger.warn('Failed to deactivate push tokens on logout', { error: err })
      );
    }

    if (allDevices) {
      // Revoke all sessions for this user
      const count = await revokeAllSessions(req.userId!, 'USER_LOGOUT_ALL');
      return res.json({
        success: true,
        message: req.t('auth:logoutAllDevices', { count }),
      });
    }

    if (refreshToken) {
      // Find and revoke the specific session
      const validation = await validateSession(refreshToken);
      if (validation.valid && validation.sessionId) {
        await revokeSession(validation.sessionId, 'USER_LOGOUT');
      }
    }

    return res.json({
      success: true,
      message: req.t('auth:logoutSuccess'),
    });
  } catch (error) {
    logger.error('❌ Logout error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * GET /auth/me
 *
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await getUserProfile(req.userId!);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: req.t('auth:userNotFound'),
      });
    }

    const needsOnboard = await needsOnboarding(req.userId!);

    return res.json({
      success: true,
      user: profile,
      needsOnboarding: needsOnboard,
    });
  } catch (error) {
    logger.error('❌ Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * DELETE /auth/delete-account
 *
 * Permanently delete user account (soft-delete)
 */
router.delete('/delete-account', authMiddleware, auditLog('AUTH_DELETE_ACCOUNT'), async (req: AuthRequest, res: Response) => {
  try {
    const success = await deleteAccount(req.userId!);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: req.t('auth:userNotFound'),
      });
    }

    return res.json({
      success: true,
      message: req.t('auth:accountDeleted'),
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * PUT /auth/language
 *
 * Update user's preferred language
 */
router.put('/language', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { language } = req.body;

    if (!language || !['fr', 'en'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: req.t('auth:invalidLanguage'),
      });
    }

    const { pool } = await import('../services/database');
    await pool.query(
      'UPDATE users SET preferred_language = $1, updated_at = NOW() WHERE id = $2',
      [language, req.userId]
    );

    return res.json({
      success: true,
      message: req.t('auth:languageUpdated'),
      language,
    });
  } catch (error) {
    logger.error('❌ Update language error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * Helper function to detect device type from user agent
 */
function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

export default router;
