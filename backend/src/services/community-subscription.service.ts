import { pool } from './database';
import {
    CommunitySubscription,
    SubscriptionStatus,
    TrialPeriodDays
} from '../types/community-activity.types';
import { communityNotificationService } from './community-notification.service';

interface CreateSubscriptionDTO {
    community_id: string;
    talent_id: string;
    paystack_reference?: string;
    paystack_subscription_code?: string;
    paystack_customer_code?: string;
}

interface SubscriptionWithCommunity extends CommunitySubscription {
    community?: {
        id: string;
        name: string;
        slug: string;
        monthly_price: number;
        currency: string;
        trial_period_days: number;
    };
}

export class CommunitySubscriptionService {

    /**
     * Create a new subscription (with optional trial)
     */
    async createSubscription(dto: CreateSubscriptionDTO): Promise<CommunitySubscription> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get community details
            const communityRes = await client.query(
                `SELECT id, name, is_paid, monthly_price, currency, trial_period_days
                 FROM communities WHERE id = $1`,
                [dto.community_id]
            );

            if (communityRes.rows.length === 0) {
                throw new Error('Community not found');
            }

            const community = communityRes.rows[0];

            if (!community.is_paid) {
                throw new Error('This community is free, no subscription needed');
            }

            // Check if membership is approved (ACTIVE) - subscription requires admin approval first
            const membershipRes = await client.query(
                `SELECT status FROM community_members WHERE community_id = $1 AND talent_id = $2`,
                [dto.community_id, dto.talent_id]
            );

            if (membershipRes.rows.length === 0) {
                throw new Error('Vous devez d\'abord demander à rejoindre la communauté');
            }

            const membershipStatus = membershipRes.rows[0].status;
            if (membershipStatus !== 'ACTIVE') {
                throw new Error('Votre demande d\'adhésion doit être approuvée avant de pouvoir souscrire');
            }

            // Check if already subscribed
            const existingRes = await client.query(
                `SELECT id, status FROM community_subscriptions
                 WHERE community_id = $1 AND talent_id = $2`,
                [dto.community_id, dto.talent_id]
            );

            if (existingRes.rows.length > 0) {
                const existing = existingRes.rows[0];
                if (existing.status === 'ACTIVE' || existing.status === 'TRIAL') {
                    throw new Error('You already have an active subscription');
                }
                // If expired or cancelled, delete the old one
                await client.query('DELETE FROM community_subscriptions WHERE id = $1', [existing.id]);
            }

            // Calculate dates
            const now = new Date();
            const trialDays = community.trial_period_days || 0;
            const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

            // If trial, period end is trial end, otherwise 1 month from now
            const periodEnd = trialEndsAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const status: SubscriptionStatus = trialDays > 0 ? 'TRIAL' : 'ACTIVE';

            const query = `
                INSERT INTO community_subscriptions (
                    community_id, talent_id, status, started_at, trial_ends_at,
                    current_period_start, current_period_end, amount, currency,
                    paystack_subscription_code, paystack_customer_code, auto_renew
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const result = await client.query(query, [
                dto.community_id,
                dto.talent_id,
                status,
                now,
                trialEndsAt,
                now,
                periodEnd,
                community.monthly_price,
                community.currency || 'XOF',
                dto.paystack_subscription_code || null,
                dto.paystack_customer_code || null,
                true // auto_renew default
            ]);

            const subscription = result.rows[0];

            // Note: Membership status is already ACTIVE (verified before subscription creation)
            // No need to update membership status here

            await client.query('COMMIT');

            // Send notification
            if (status === 'TRIAL') {
                communityNotificationService.createNotification({
                    talent_id: dto.talent_id,
                    community_id: dto.community_id,
                    type: 'PAYMENT_SUCCESS',
                    title: 'Période d\'essai activée',
                    body: `Votre période d'essai de ${trialDays} jours pour "${community.name}" a commencé.`
                }).catch(err => console.error('Failed to send trial notification:', err));
            }

            return subscription;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get subscription status for a user in a community
     */
    async getSubscription(communityId: string, talentId: string): Promise<SubscriptionWithCommunity | null> {
        const result = await pool.query(`
            SELECT
                cs.*,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'monthly_price', c.monthly_price,
                    'currency', c.currency,
                    'trial_period_days', c.trial_period_days
                ) as community
            FROM community_subscriptions cs
            JOIN communities c ON cs.community_id = c.id
            WHERE cs.community_id = $1 AND cs.talent_id = $2
        `, [communityId, talentId]);

        return result.rows[0] || null;
    }

    /**
     * Get all subscriptions for a user
     */
    async getUserSubscriptions(talentId: string): Promise<SubscriptionWithCommunity[]> {
        const result = await pool.query(`
            SELECT
                cs.*,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'monthly_price', c.monthly_price,
                    'currency', c.currency,
                    'cover_image_url', c.cover_image_url
                ) as community
            FROM community_subscriptions cs
            JOIN communities c ON cs.community_id = c.id
            WHERE cs.talent_id = $1
            ORDER BY cs.created_at DESC
        `, [talentId]);

        return result.rows;
    }

    /**
     * Check if user has active access to community
     */
    async hasActiveAccess(communityId: string, talentId: string): Promise<boolean> {
        // First check if community is paid
        const communityRes = await pool.query(
            'SELECT is_paid, organization_id FROM communities WHERE id = $1',
            [communityId]
        );

        if (communityRes.rows.length === 0) {
            return false;
        }

        const community = communityRes.rows[0];

        // Check if user is organization OWNER/ADMIN/MANAGER - they get free access
        if (community.organization_id) {
            const orgAdminCheck = await pool.query(`
                SELECT 1 FROM organization_members
                WHERE organization_id = $1 
                  AND talent_id = $2 
                  AND role IN ('OWNER', 'ADMIN', 'MANAGER')
            `, [community.organization_id, talentId]);

            if (orgAdminCheck.rows.length > 0) {
                // Org admins get free access to all communities in their organization
                return true;
            }
        }

        if (!community.is_paid) {
            // Free community - check membership only
            const memberRes = await pool.query(
                `SELECT 1 FROM community_members WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
                [communityId, talentId]
            );
            return memberRes.rows.length > 0;
        }

        // Paid community - check subscription
        const subRes = await pool.query(`
            SELECT 1 FROM community_subscriptions
            WHERE community_id = $1
              AND talent_id = $2
              AND status IN ('ACTIVE', 'TRIAL')
              AND current_period_end > NOW()
        `, [communityId, talentId]);

        return subRes.rows.length > 0;
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId: string, talentId: string): Promise<CommunitySubscription> {
        const subRes = await pool.query(
            'SELECT * FROM community_subscriptions WHERE id = $1 AND talent_id = $2',
            [subscriptionId, talentId]
        );

        if (subRes.rows.length === 0) {
            throw new Error('Subscription not found');
        }

        const subscription = subRes.rows[0];

        if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
            throw new Error('Subscription is already cancelled or expired');
        }

        // Update subscription
        const result = await pool.query(`
            UPDATE community_subscriptions
            SET status = 'CANCELLED', cancelled_at = NOW(), auto_renew = FALSE
            WHERE id = $1
            RETURNING *
        `, [subscriptionId]);

        // TODO: Cancel on Paystack if applicable
        // await this.cancelPaystackSubscription(subscription.paystack_subscription_code);

        return result.rows[0];
    }

    /**
     * Renew subscription (after successful payment)
     */
    async renewSubscription(subscriptionId: string, paymentId: string): Promise<CommunitySubscription> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const subRes = await client.query(
                'SELECT * FROM community_subscriptions WHERE id = $1 FOR UPDATE',
                [subscriptionId]
            );

            if (subRes.rows.length === 0) {
                throw new Error('Subscription not found');
            }

            const subscription = subRes.rows[0];

            // Calculate new period
            const now = new Date();
            const newPeriodStart = new Date(Math.max(now.getTime(), new Date(subscription.current_period_end).getTime()));
            const newPeriodEnd = new Date(newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

            const result = await client.query(`
                UPDATE community_subscriptions
                SET status = 'ACTIVE',
                    current_period_start = $1,
                    current_period_end = $2,
                    trial_ends_at = NULL,
                    auto_renew = TRUE
                WHERE id = $3
                RETURNING *
            `, [newPeriodStart, newPeriodEnd, subscriptionId]);

            await client.query('COMMIT');

            return result.rows[0];

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Process expiring subscriptions (called by cron)
     * - Mark expired subscriptions
     * - Send reminders for expiring soon
     */
    async processExpiringSubscriptions(): Promise<{
        expired: number,
        reminded: number
    }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Mark expired subscriptions
            const expiredRes = await client.query(`
                UPDATE community_subscriptions cs
                SET status = 'EXPIRED'
                FROM communities c
                WHERE cs.community_id = c.id
                  AND cs.status IN ('ACTIVE', 'TRIAL', 'PAST_DUE')
                  AND cs.current_period_end < NOW()
                RETURNING cs.*, c.name as community_name
            `);

            // Notify expired users
            for (const sub of expiredRes.rows) {
                communityNotificationService.notifySubscriptionExpired(
                    sub.talent_id,
                    sub.community_id,
                    sub.community_name
                ).catch(err => console.error('Failed to notify expired:', err));

                // Update member status
                await client.query(`
                    UPDATE community_members
                    SET status = 'SUSPENDED'
                    WHERE community_id = $1 AND talent_id = $2
                `, [sub.community_id, sub.talent_id]);
            }

            // 2. Send reminders for expiring in 3 days
            const remindRes = await client.query(`
                SELECT cs.*, c.name as community_name
                FROM community_subscriptions cs
                JOIN communities c ON cs.community_id = c.id
                WHERE cs.status IN ('ACTIVE', 'TRIAL')
                  AND cs.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '3 days'
                  AND NOT EXISTS (
                      SELECT 1 FROM community_notifications cn
                      WHERE cn.talent_id = cs.talent_id
                        AND cn.community_id = cs.community_id
                        AND cn.type = 'SUBSCRIPTION_EXPIRING'
                        AND cn.created_at > NOW() - INTERVAL '3 days'
                  )
            `);

            for (const sub of remindRes.rows) {
                communityNotificationService.notifySubscriptionExpiring(
                    sub.talent_id,
                    sub.community_id,
                    sub.community_name,
                    new Date(sub.current_period_end)
                ).catch(err => console.error('Failed to notify expiring:', err));
            }

            await client.query('COMMIT');

            return {
                expired: expiredRes.rowCount || 0,
                reminded: remindRes.rowCount || 0
            };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get subscription statistics for a community (admin)
     */
    async getCommunitySubscriptionStats(communityId: string): Promise<{
        total_subscribers: number,
        active_subscribers: number,
        trial_subscribers: number,
        churned_this_month: number,
        mrr: number,
        currency: string
    }> {
        const result = await pool.query(`
            SELECT
                COUNT(*) as total_subscribers,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_subscribers,
                COUNT(*) FILTER (WHERE status = 'TRIAL') as trial_subscribers,
                COUNT(*) FILTER (
                    WHERE status IN ('CANCELLED', 'EXPIRED')
                    AND cancelled_at >= DATE_TRUNC('month', NOW())
                ) as churned_this_month,
                COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE'), 0) as mrr,
                MAX(currency) as currency
            FROM community_subscriptions
            WHERE community_id = $1
        `, [communityId]);

        return result.rows[0];
    }

    /**
     * Reactivate a cancelled/expired subscription
     */
    async reactivateSubscription(
        subscriptionId: string,
        talentId: string,
        paymentId: string
    ): Promise<CommunitySubscription> {
        const subRes = await pool.query(
            'SELECT * FROM community_subscriptions WHERE id = $1 AND talent_id = $2',
            [subscriptionId, talentId]
        );

        if (subRes.rows.length === 0) {
            throw new Error('Subscription not found');
        }

        const subscription = subRes.rows[0];

        if (subscription.status === 'ACTIVE') {
            throw new Error('Subscription is already active');
        }

        // Calculate new period starting now
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE community_subscriptions
                SET status = 'ACTIVE',
                    current_period_start = $1,
                    current_period_end = $2,
                    cancelled_at = NULL,
                    auto_renew = TRUE
                WHERE id = $3
                RETURNING *
            `, [now, periodEnd, subscriptionId]);

            // Reactivate member
            await client.query(`
                UPDATE community_members
                SET status = 'ACTIVE'
                WHERE community_id = $1 AND talent_id = $2
            `, [subscription.community_id, talentId]);

            await client.query('COMMIT');

            return result.rows[0];

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}

export const communitySubscriptionService = new CommunitySubscriptionService();
