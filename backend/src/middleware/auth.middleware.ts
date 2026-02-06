/**
 * Auth Middleware
 *
 * Protects routes that require authentication
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/auth.service';
import { pool } from '../services/database';

import { logger } from '../utils';
export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  talentId?: string;
  tokenPayload?: TokenPayload;
}

/**
 * Middleware to verify JWT access token
 *
 * Requires valid Bearer token in Authorization header
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: req.t('common:missingToken'),
      code: 'MISSING_TOKEN',
    });
    return;
  }

  // Extract token from "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      success: false,
      error: req.t('common:invalidTokenFormat'),
      code: 'INVALID_TOKEN_FORMAT',
    });
    return;
  }

  const token = parts[1];

  // Verify token
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: req.t('common:invalidToken'),
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Attach user info to request
  req.userId = payload.userId;
  req.userEmail = payload.email;
  req.talentId = payload.talentId;
  req.tokenPayload = payload;

  // If talentId is not in token, look it up from database
  if (!req.talentId && req.userId) {
    try {
      const result = await pool.query(
        'SELECT talent_id FROM users WHERE id = $1 AND deleted_at IS NULL',
        [req.userId]
      );
      if (result.rows.length > 0 && result.rows[0].talent_id) {
        req.talentId = result.rows[0].talent_id;
      }
    } catch (error) {
      logger.error('Error looking up talentId:', error);
    }
  }

  next();
}

/**
 * Optional auth middleware
 *
 * Attaches user info if token is present, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next();
  }

  const token = parts[1];
  const payload = verifyAccessToken(token);

  if (payload) {
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.talentId = payload.talentId;
    req.tokenPayload = payload;

    // If talentId is not in token, look it up from database
    if (!req.talentId && req.userId) {
      try {
        const result = await pool.query(
          'SELECT talent_id FROM users WHERE id = $1 AND deleted_at IS NULL',
          [req.userId]
        );
        if (result.rows.length > 0 && result.rows[0].talent_id) {
          req.talentId = result.rows[0].talent_id;
        }
      } catch (error) {
        // Silently continue without talentId
      }
    }
  }

  next();
}

/**
 * Middleware to require completed onboarding (talent profile)
 *
 * Use after authMiddleware
 */
export function requireTalentProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.talentId) {
    res.status(403).json({
      success: false,
      error: req.t('common:talentProfileRequired'),
      code: 'ONBOARDING_REQUIRED',
      message: req.t('common:completeProfile'),
    });
    return;
  }

  next();
}

/**
 * Admin emails - stored in environment variable as comma-separated list
 * In production, this should be a database table
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@etudesk.com').split(',').map(e => e.trim().toLowerCase());

/**
 * Check if user is an admin
 */
export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Middleware to require admin privileges
 * Use after authMiddleware
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!isAdmin(req.userEmail)) {
    res.status(403).json({
      success: false,
      error: req.t('common:accessDenied'),
      code: 'ADMIN_REQUIRED',
      message: req.t('common:adminRequired'),
    });
    return;
  }

  next();
}
