/**
 * Auth Routes
 *
 * OTP Passwordless Authentication
 */

import { Router, Request, Response } from 'express';
import { createOTP, verifyOTP } from '../services/otp.service';
import { sendOTPEmail } from '../services/email.service';
import {
  generateTokens,
  createSession,
  validateSession,
  refreshTokens,
  revokeSession,
  revokeAllSessions,
  getUserProfile,
  needsOnboarding,
} from '../services/auth.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /auth/request-otp
 *
 * Request an OTP code to be sent to email
 */
router.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email requis',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email invalide',
      });
    }

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
      console.error('❌ Failed to send OTP email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer.',
      });
    }

    return res.json({
      success: true,
      message: 'Code envoyé par email',
      expiresAt: otpResult.expiresAt,
    });
  } catch (error) {
    console.error('❌ Request OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * POST /auth/verify-otp
 *
 * Verify OTP and create session
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email et code requis',
      });
    }

    if (typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Code invalide (6 chiffres requis)',
      });
    }

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
      message: verifyResult.isNewUser ? 'Compte créé avec succès' : 'Connexion réussie',
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
    console.error('❌ Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * POST /auth/refresh
 *
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requis',
      });
    }

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
    console.error('❌ Refresh token error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * POST /auth/logout
 *
 * Logout current session
 */
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken, allDevices } = req.body;

    if (allDevices) {
      // Revoke all sessions for this user
      const count = await revokeAllSessions(req.userId!, 'USER_LOGOUT_ALL');
      return res.json({
        success: true,
        message: `Déconnecté de ${count} appareil(s)`,
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
      message: 'Déconnexion réussie',
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
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
        error: 'Utilisateur non trouvé',
      });
    }

    const needsOnboard = await needsOnboarding(req.userId!);

    return res.json({
      success: true,
      user: profile,
      needsOnboarding: needsOnboard,
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
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
