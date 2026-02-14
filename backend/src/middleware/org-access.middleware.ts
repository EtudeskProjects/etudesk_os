/**
 * Organization Access Middleware
 *
 * Centralized permission checks for organization routes.
 * Replaces inline permission checks scattered across org routes.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../services/database';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils';

type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface OrgAccessRequest extends AuthRequest {
  orgId?: string;
  orgRole?: OrgRole;
  orgPermissions?: string[];
}

/**
 * Middleware factory: require user to have one of the specified roles in the org.
 *
 * Usage:
 *   router.put('/:orgId', authMiddleware, requireOrgRole(['OWNER', 'ADMIN']), handler)
 *
 * Reads orgId from req.params.orgId or req.params.id.
 */
export function requireOrgRole(allowedRoles: OrgRole[]) {
  return async (req: OrgAccessRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.params.orgId || req.params.id;
      const talentId = req.talentId;

      if (!orgId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required',
          code: 'MISSING_ORG_ID',
        });
        return;
      }

      if (!talentId) {
        res.status(401).json({
          success: false,
          error: req.t('common:talentProfileRequired'),
          code: 'ONBOARDING_REQUIRED',
        });
        return;
      }

      const result = await pool.query(
        `SELECT role, permissions FROM organization_members
         WHERE organization_id = $1 AND talent_id = $2`,
        [orgId, talentId]
      );

      if (result.rows.length === 0) {
        res.status(403).json({
          success: false,
          error: 'You are not a member of this organization',
          code: 'NOT_ORG_MEMBER',
        });
        return;
      }

      const { role, permissions } = result.rows[0];

      if (!allowedRoles.includes(role as OrgRole)) {
        res.status(403).json({
          success: false,
          error: `Requires one of: ${allowedRoles.join(', ')}`,
          code: 'INSUFFICIENT_ORG_ROLE',
        });
        return;
      }

      req.orgId = orgId;
      req.orgRole = role as OrgRole;
      req.orgPermissions = permissions || [];

      next();
    } catch (error) {
      logger.error('Org access middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify organization membership',
      });
    }
  };
}
