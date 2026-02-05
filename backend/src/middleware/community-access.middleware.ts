import { Request, Response, NextFunction } from 'express';
import { pool } from '../services/database';
import { communityPermissionService } from '../services/community-permission.service';

import { logger } from '../utils';
/**
 * Extended request with community access info
 */
export interface CommunityAccessRequest extends Request {
    talentId?: string;
    userId?: string;
    communityId?: string;
    communityAccess?: {
        isMember: boolean;
        role: 'ADMIN' | 'MEMBER' | null;
    };
}

/**
 * Middleware to check if user is a member of the community
 * Sets req.communityAccess with membership details
 */
export async function communityMemberMiddleware(
    req: CommunityAccessRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const communityId = req.params.communityId || req.params.id;
        const talentId = req.talentId || req.userId;

        if (!communityId || !talentId) {
            return res.status(400).json({ error: 'Community ID and authentication required' });
        }

        req.communityId = communityId;

        // Check membership
        const memberResult = await pool.query(`
            SELECT cm.role, cm.status
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.community_id = $1 AND cm.talent_id = $2
        `, [communityId, talentId]);

        if (memberResult.rows.length === 0) {
            req.communityAccess = {
                isMember: false,
                role: null,
            };
            return res.status(403).json({
                error: 'Not a member of this community',
                code: 'NOT_MEMBER'
            });
        }

        const member = memberResult.rows[0];

        if (member.status !== 'ACTIVE') {
            return res.status(403).json({
                error: 'Membership is not active',
                code: 'MEMBERSHIP_INACTIVE',
                status: member.status
            });
        }

        req.communityAccess = {
            isMember: true,
            role: member.role,
        };

        next();
    } catch (error: any) {
        logger.error('Community member middleware error:', error);
        res.status(500).json({ error: 'Failed to verify community membership' });
    }
}

/**
 * Middleware to check if user is admin of the community
 * (Simplified: org members are ADMIN, everyone else is MEMBER)
 */
export async function communityAdminMiddleware(
    req: CommunityAccessRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const communityId = req.params.communityId || req.params.id;
        const talentId = req.talentId || req.userId;

        if (!communityId || !talentId) {
            return res.status(400).json({ error: 'Community ID and authentication required' });
        }

        // Use permission service to get role (includes org member check)
        const role = await communityPermissionService.getUserRole(talentId, communityId);

        if (!role) {
            return res.status(403).json({
                error: 'Not a member of this community',
                code: 'NOT_MEMBER'
            });
        }

        if (role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Admin access required',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        req.communityAccess = {
            isMember: true,
            role,
        };

        next();
    } catch (error: any) {
        logger.error('Community admin middleware error:', error);
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
}

/**
 * Middleware to check if user is specifically an admin
 * (Same as communityAdminMiddleware now that roles are simplified)
 */
export async function communityOwnerMiddleware(
    req: CommunityAccessRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const communityId = req.params.communityId || req.params.id;
        const talentId = req.talentId || req.userId;

        if (!communityId || !talentId) {
            return res.status(400).json({ error: 'Community ID and authentication required' });
        }

        // Use permission service to get role (includes org admin check)
        const role = await communityPermissionService.getUserRole(talentId, communityId);

        if (!role || role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        next();
    } catch (error: any) {
        logger.error('Community owner middleware error:', error);
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
}
