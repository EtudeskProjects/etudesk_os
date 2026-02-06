import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { communitySubscriptionService } from '../services/community-subscription.service';
import { communityPaymentService } from '../services/community-payment.service';
import { communityAdminMiddleware, CommunityAccessRequest } from '../middleware/community-access.middleware';
import { communityPermissionService } from '../services/community-permission.service';
import { pool } from '../services/database';

import { logger } from '../utils';
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// USER SUBSCRIPTION ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/community-subscriptions/my
 * Get all subscriptions for the current user
 */
router.get('/my', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const subscriptions = await communitySubscriptionService.getUserSubscriptions(talentId);
        res.json({ data: subscriptions });
    } catch (error: any) {
        logger.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/:communityId
 * Get subscription status for a specific community
 */
router.get('/:communityId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const talentId = req.talentId || req.userId;

        const subscription = await communitySubscriptionService.getSubscription(communityId, talentId);

        if (!subscription) {
            return res.json({ data: {
                subscribed: false,
                subscription: null
            }});
        }

        res.json({ data: {
            subscribed: ['ACTIVE', 'TRIAL'].includes(subscription.status),
            subscription
        }});
    } catch (error: any) {
        logger.error('Error fetching subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/community-subscriptions/:communityId/subscribe
 * Start a subscription (with trial if available)
 */
router.post('/:communityId/subscribe', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const talentId = req.talentId || req.userId;

        // Check if user is a member first and their membership is approved
        const memberResult = await pool.query(
            `SELECT status FROM community_members WHERE community_id = $1 AND talent_id = $2`,
            [communityId, talentId]
        );

        if (memberResult.rows.length === 0) {
            return res.status(400).json({
                error: req.t('communities:subscriptionMustJoinFirst'),
                code: 'NOT_MEMBER'
            });
        }

        const memberStatus = memberResult.rows[0].status;

        // Membership must be approved (ACTIVE) before subscribing
        if (memberStatus === 'PENDING') {
            return res.status(403).json({
                error: req.t('communities:subscriptionPendingApproval'),
                code: 'MEMBERSHIP_PENDING_APPROVAL'
            });
        }

        if (memberStatus === 'REJECTED') {
            return res.status(403).json({
                error: req.t('communities:subscriptionRequestRejected'),
                code: 'MEMBERSHIP_REJECTED'
            });
        }

        if (memberStatus === 'SUSPENDED') {
            return res.status(403).json({
                error: req.t('communities:subscriptionMembershipSuspended'),
                code: 'MEMBERSHIP_SUSPENDED'
            });
        }

        if (memberStatus !== 'ACTIVE') {
            return res.status(403).json({
                error: req.t('communities:subscriptionApprovalRequired'),
                code: 'MEMBERSHIP_NOT_ACTIVE'
            });
        }

        // Check if user is org admin/owner/manager - they don't need subscription
        const communityCheck = await pool.query(
            'SELECT organization_id FROM communities WHERE id = $1',
            [communityId]
        );

        if (communityCheck.rows.length > 0 && communityCheck.rows[0].organization_id) {
            const orgAdminCheck = await pool.query(`
                SELECT 1 FROM organization_members
                WHERE organization_id = $1 
                  AND talent_id = $2 
                  AND role IN ('OWNER', 'ADMIN', 'MANAGER')
            `, [communityCheck.rows[0].organization_id, talentId]);

            if (orgAdminCheck.rows.length > 0) {
                return res.status(400).json({
                    error: req.t('communities:subscriptionAlreadyFreeAccess'),
                    code: 'ORG_ADMIN_FREE_ACCESS'
                });
            }
        }

        const subscription = await communitySubscriptionService.createSubscription({
            community_id: communityId,
            talent_id: talentId
        });

        res.status(201).json({
            success: true,
            subscription,
            message: subscription.status === 'TRIAL'
                ? `Période d'essai activée jusqu'au ${new Date(subscription.trial_ends_at!).toLocaleDateString('fr-FR')}`
                : 'Abonnement créé'
        });
    } catch (error: any) {
        logger.error('Error creating subscription:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/community-subscriptions/:subscriptionId/pay
 * Initialize payment for a subscription
 */
router.post('/:subscriptionId/pay', authMiddleware, async (req: any, res: Response) => {
    try {
        const { subscriptionId } = req.params;
        const talentId = req.talentId || req.userId;
        const { callback_url } = req.body;

        // Get user email
        const userResult = await pool.query(
            'SELECT email FROM talents WHERE id = $1',
            [talentId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: req.t('communities:userNotFound') });
        }

        const payment = await communityPaymentService.initializePayment({
            subscription_id: subscriptionId,
            talent_id: talentId,
            email: userResult.rows[0].email,
            callback_url
        });

        res.json({
            success: true,
            ...payment
        });
    } catch (error: any) {
        logger.error('Error initializing payment:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/:subscriptionId/verify/:reference
 * Verify a payment
 */
router.get('/:subscriptionId/verify/:reference', authMiddleware, async (req: any, res: Response) => {
    try {
        const { reference } = req.params;

        const payment = await communityPaymentService.verifyPayment(reference);

        res.json({
            success: payment.status === 'SUCCESS',
            payment
        });
    } catch (error: any) {
        logger.error('Error verifying payment:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/community-subscriptions/:subscriptionId/cancel
 * Cancel a subscription
 */
router.post('/:subscriptionId/cancel', authMiddleware, async (req: any, res: Response) => {
    try {
        const { subscriptionId } = req.params;
        const talentId = req.talentId || req.userId;

        const subscription = await communitySubscriptionService.cancelSubscription(subscriptionId, talentId);

        res.json({
            success: true,
            subscription,
            message: req.t('communities:subscriptionCancelledWithAccess', { date: new Date(subscription.current_period_end).toLocaleDateString(req.language === 'en' ? 'en-US' : 'fr-FR') })
        });
    } catch (error: any) {
        logger.error('Error cancelling subscription:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/community-subscriptions/:subscriptionId/reactivate
 * Reactivate a cancelled/expired subscription
 */
router.post('/:subscriptionId/reactivate', authMiddleware, async (req: any, res: Response) => {
    try {
        const { subscriptionId } = req.params;
        const talentId = req.talentId || req.userId;
        const { payment_id } = req.body;

        if (!payment_id) {
            return res.status(400).json({ error: req.t('communities:paymentIdRequired') });
        }

        const subscription = await communitySubscriptionService.reactivateSubscription(
            subscriptionId,
            talentId,
            payment_id
        );

        res.json({
            success: true,
            subscription
        });
    } catch (error: any) {
        logger.error('Error reactivating subscription:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/:subscriptionId/payments
 * Get payment history for a subscription
 */
router.get('/:subscriptionId/payments', authMiddleware, async (req: any, res: Response) => {
    try {
        const { subscriptionId } = req.params;
        const talentId = req.talentId || req.userId;

        const payments = await communityPaymentService.getPaymentHistory(subscriptionId, talentId);

        res.json({ data: payments });
    } catch (error: any) {
        logger.error('Error fetching payments:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/:subscriptionId/invoices
 * Get invoices for a subscription
 */
router.get('/:subscriptionId/invoices', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const { limit, offset } = req.query;

        const invoices = await communityPaymentService.getUserInvoices(
            talentId,
            limit ? parseInt(limit as string) : 20,
            offset ? parseInt(offset as string) : 0
        );

        res.json({ data: invoices });
    } catch (error: any) {
        logger.error('Error fetching invoices:', error);
        res.status(400).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// INVOICE ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/community-subscriptions/invoices/all
 * Get all invoices for current user
 */
router.get('/invoices/all', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const { limit, offset } = req.query;

        const invoices = await communityPaymentService.getUserInvoices(
            talentId,
            limit ? parseInt(limit as string) : 50,
            offset ? parseInt(offset as string) : 0
        );

        res.json({ data: invoices });
    } catch (error: any) {
        logger.error('Error fetching invoices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/invoices/:invoiceId
 * Get a specific invoice
 */
router.get('/invoices/:invoiceId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { invoiceId } = req.params;
        const talentId = req.talentId || req.userId;

        const invoice = await communityPaymentService.getInvoice(invoiceId, talentId);

        if (!invoice) {
            return res.status(404).json({ error: req.t('communities:invoiceNotFound') });
        }

        res.json({ data: invoice });
    } catch (error: any) {
        logger.error('Error fetching invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/invoices/number/:invoiceNumber
 * Get invoice by number
 */
router.get('/invoices/number/:invoiceNumber', authMiddleware, async (req: any, res: Response) => {
    try {
        const { invoiceNumber } = req.params;
        const talentId = req.talentId || req.userId;

        const invoice = await communityPaymentService.getInvoiceByNumber(invoiceNumber, talentId);

        if (!invoice) {
            return res.status(404).json({ error: req.t('communities:invoiceNotFound') });
        }

        res.json({ data: invoice });
    } catch (error: any) {
        logger.error('Error fetching invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES (Community Owner/Admin)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/community-subscriptions/admin/:communityId/stats
 * Get subscription stats for a community (admin only - org admins included)
 */
router.get('/admin/:communityId/stats', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const talentId = req.talentId || req.userId;

        // Check admin access (includes org admins)
        const role = await communityPermissionService.getUserRole(talentId, communityId);
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: req.t('communities:adminAccessRequired') });
        }

        const stats = await communitySubscriptionService.getCommunitySubscriptionStats(communityId);

        res.json(stats);
    } catch (error: any) {
        logger.error('Error fetching subscription stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/admin/:communityId/revenue
 * Get revenue stats for a community (admin only - org admins included)
 */
router.get('/admin/:communityId/revenue', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const talentId = req.talentId || req.userId;
        const { start_date, end_date } = req.query;

        // Check admin access (includes org admins)
        const role = await communityPermissionService.getUserRole(talentId, communityId);
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: req.t('communities:adminAccessRequired') });
        }

        const stats = await communityPaymentService.getCommunityRevenueStats(
            communityId,
            start_date ? new Date(start_date as string) : undefined,
            end_date ? new Date(end_date as string) : undefined
        );

        res.json(stats);
    } catch (error: any) {
        logger.error('Error fetching revenue stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-subscriptions/admin/:communityId/subscribers
 * Get list of subscribers for a community (explicit community ADMIN only - org admins excluded)
 */
router.get('/admin/:communityId/subscribers', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const talentId = req.talentId || req.userId;
        const { status, limit, offset } = req.query;

        // Check explicit community ADMIN access (not org admins - this is member management)
        const adminResult = await pool.query(
            `SELECT role FROM community_members WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE' AND role = 'ADMIN'`,
            [communityId, talentId]
        );

        if (adminResult.rows.length === 0) {
            return res.status(403).json({ 
                error: req.t('communities:subscriptionAdminAccessRequired') 
            });
        }

        let whereClause = 'WHERE cs.community_id = $1';
        const params: any[] = [communityId];
        let paramIndex = 2;

        if (status) {
            whereClause += ` AND cs.status = $${paramIndex++}`;
            params.push(status);
        }

        const result = await pool.query(`
            SELECT
                cs.*,
                json_build_object(
                    'id', t.id,
                    'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email),
                    'email', t.email,
                    'avatar_url', t.avatar_url
                ) as talent
            FROM community_subscriptions cs
            JOIN talents t ON cs.talent_id = t.id
            ${whereClause}
            ORDER BY cs.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...params, limit ? parseInt(limit as string) : 50, offset ? parseInt(offset as string) : 0]);

        res.json({ data: result.rows });
    } catch (error: any) {
        logger.error('Error fetching subscribers:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
