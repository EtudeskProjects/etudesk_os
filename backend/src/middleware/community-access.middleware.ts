import { Request, Response, NextFunction } from 'express';
import { pool } from '../services/database';
import { communitySubscriptionService } from '../services/community-subscription.service';
import { communityPermissionService } from '../services/community-permission.service';

/**
 * Extended request with community access info
 */
export interface CommunityAccessRequest extends Request {
    talentId?: string;
    userId?: string;
    communityId?: string;
    communityAccess?: {
        isMember: boolean;
        role: 'ADMIN' | 'MEMBER' | null;  // Simplified: ADMIN (org members) or MEMBER
        isPaid: boolean;
        hasActiveSubscription: boolean;
        subscriptionStatus?: string;
        trialEndsAt?: Date;
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
            SELECT cm.role, cm.status, c.is_paid, c.monthly_price
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.community_id = $1 AND cm.talent_id = $2
        `, [communityId, talentId]);

        if (memberResult.rows.length === 0) {
            req.communityAccess = {
                isMember: false,
                role: null,
                isPaid: false,
                hasActiveSubscription: false
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
            isPaid: member.is_paid,
            hasActiveSubscription: !member.is_paid // Free communities always have access
        };

        next();
    } catch (error: any) {
        console.error('Community member middleware error:', error);
        res.status(500).json({ error: 'Failed to verify community membership' });
    }
}

/**
 * Middleware to check if user has active access to paid community content
 * Use this for routes that require paid subscription
 */
export async function communityPaidAccessMiddleware(
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

        // Check if community is paid
        const communityResult = await pool.query(
            'SELECT is_paid, monthly_price, currency, name FROM communities WHERE id = $1',
            [communityId]
        );

        if (communityResult.rows.length === 0) {
            return res.status(404).json({ error: 'Community not found' });
        }

        const community = communityResult.rows[0];

        // If community is free, just check membership
        if (!community.is_paid) {
            const memberResult = await pool.query(
                `SELECT role, status FROM community_members WHERE community_id = $1 AND talent_id = $2`,
                [communityId, talentId]
            );

            if (memberResult.rows.length === 0 || memberResult.rows[0].status !== 'ACTIVE') {
                return res.status(403).json({
                    error: 'Not a member of this community',
                    code: 'NOT_MEMBER'
                });
            }

            req.communityAccess = {
                isMember: true,
                role: memberResult.rows[0].role,
                isPaid: false,
                hasActiveSubscription: true
            };

            return next();
        }

        // For paid communities, check subscription
        const hasAccess = await communitySubscriptionService.hasActiveAccess(communityId, talentId);

        if (!hasAccess) {
            // Get subscription details for paywall
            const subscription = await communitySubscriptionService.getSubscription(communityId, talentId);

            return res.status(402).json({
                error: 'Subscription required',
                code: 'SUBSCRIPTION_REQUIRED',
                paywall: {
                    community_id: communityId,
                    community_name: community.name,
                    monthly_price: community.monthly_price,
                    currency: community.currency || 'XOF',
                    subscription_status: subscription?.status || null,
                    expired_at: subscription?.current_period_end || null
                }
            });
        }

        // Get full access details
        const subscription = await communitySubscriptionService.getSubscription(communityId, talentId);
        const memberResult = await pool.query(
            `SELECT role FROM community_members WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
            [communityId, talentId]
        );

        req.communityAccess = {
            isMember: true,
            role: memberResult.rows[0]?.role || 'MEMBER',
            isPaid: true,
            hasActiveSubscription: true,
            subscriptionStatus: subscription?.status,
            trialEndsAt: subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : undefined
        };

        next();
    } catch (error: any) {
        console.error('Community paid access middleware error:', error);
        res.status(500).json({ error: 'Failed to verify community access' });
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
            isPaid: false,
            hasActiveSubscription: true
        };

        next();
    } catch (error: any) {
        console.error('Community admin middleware error:', error);
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
        console.error('Community owner middleware error:', error);
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
}
