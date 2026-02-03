import { pool } from './database';
import {
    CommunityPayment,
    CommunityInvoice,
    PaymentStatus,
    InvoiceStatus
} from '../types/community-activity.types';
import { communityNotificationService } from './community-notification.service';

import { logger } from '../utils';
import type { CommunitySubscriptionService } from './community-subscription.service';

// Lazy import to break circular dependency - properly typed
let _subscriptionService: CommunitySubscriptionService | null = null;
const getSubscriptionService = async (): Promise<CommunitySubscriptionService> => {
    if (!_subscriptionService) {
        const { communitySubscriptionService } = await import('./community-subscription.service');
        _subscriptionService = communitySubscriptionService;
    }
    return _subscriptionService;
};

// Paystack API config
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface InitializePaymentDTO {
    subscription_id: string;
    talent_id: string;
    email: string;
    callback_url?: string;
}

interface PaystackWebhookEvent {
    event: string;
    data: {
        reference: string;
        status: string;
        amount: number;
        currency: string;
        customer: {
            email: string;
            customer_code: string;
        };
        authorization?: {
            authorization_code: string;
        };
        metadata?: Record<string, unknown>;
    };
}

export class CommunityPaymentService {

    /**
     * Initialize a payment with Paystack
     */
    async initializePayment(dto: InitializePaymentDTO): Promise<{
        authorization_url: string;
        access_code: string;
        reference: string;
    }> {
        // Get subscription details
        const subRes = await pool.query(`
            SELECT cs.*, c.name as community_name, c.monthly_price, c.currency
            FROM community_subscriptions cs
            JOIN communities c ON cs.community_id = c.id
            WHERE cs.id = $1 AND cs.talent_id = $2
        `, [dto.subscription_id, dto.talent_id]);

        if (subRes.rows.length === 0) {
            throw new Error('Subscription not found');
        }

        const subscription = subRes.rows[0];

        // Generate unique reference
        const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Create pending payment record
        const periodStart = new Date();
        const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

        await pool.query(`
            INSERT INTO community_payments (
                subscription_id, amount, currency, status, paystack_reference,
                period_start, period_end
            )
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
        `, [
            dto.subscription_id,
            subscription.monthly_price,
            subscription.currency,
            reference,
            periodStart,
            periodEnd
        ]);

        // Initialize with Paystack
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: dto.email,
                amount: Math.round(subscription.monthly_price * 100), // Paystack uses kobo/cents
                currency: subscription.currency,
                reference,
                callback_url: dto.callback_url,
                metadata: {
                    subscription_id: dto.subscription_id,
                    community_id: subscription.community_id,
                    talent_id: dto.talent_id,
                    community_name: subscription.community_name
                }
            })
        });

        const result = await response.json() as {
            status: boolean;
            message?: string;
            data?: {
                authorization_url: string;
                access_code: string;
                reference: string;
            };
        };

        if (!result.status) {
            // Mark payment as failed
            await pool.query(
                `UPDATE community_payments SET status = 'FAILED', failure_reason = $1 WHERE paystack_reference = $2`,
                [result.message, reference]
            );
            throw new Error(result.message || 'Failed to initialize payment');
        }

        return {
            authorization_url: result.data!.authorization_url,
            access_code: result.data!.access_code,
            reference
        };
    }

    /**
     * Verify a payment with Paystack
     */
    async verifyPayment(reference: string): Promise<CommunityPayment> {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });

        const result = await response.json() as {
            status: boolean;
            message?: string;
            data?: {
                id: number;
                status: string;
                gateway_response: string;
                authorization?: {
                    authorization_code: string;
                };
            };
        };

        if (!result.status) {
            throw new Error(result.message || 'Failed to verify payment');
        }

        const paymentData = result.data!;

        // Get payment record
        const paymentRes = await pool.query(
            'SELECT * FROM community_payments WHERE paystack_reference = $1',
            [reference]
        );

        if (paymentRes.rows.length === 0) {
            throw new Error('Payment record not found');
        }

        const payment = paymentRes.rows[0];

        if (paymentData.status === 'success') {
            return await this.handleSuccessfulPayment(payment.id, paymentData);
        } else {
            return await this.handleFailedPayment(payment.id, paymentData.gateway_response || 'Payment failed');
        }
    }

    /**
     * Handle Paystack webhook
     */
    async handleWebhook(event: PaystackWebhookEvent): Promise<void> {
        const { event: eventType, data } = event;

        switch (eventType) {
            case 'charge.success':
                await this.handleWebhookChargeSuccess(data);
                break;

            case 'charge.failed':
                await this.handleWebhookChargeFailed(data);
                break;

            case 'subscription.create':
                // Handle subscription created
                break;

            case 'subscription.disable':
                // Handle subscription disabled
                break;

            case 'invoice.payment_failed':
                await this.handleWebhookInvoiceFailed(data);
                break;

            default:
                logger.info(`Unhandled webhook event: ${eventType}`);
        }
    }

    private async handleWebhookChargeSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
        const paymentRes = await pool.query(
            'SELECT * FROM community_payments WHERE paystack_reference = $1',
            [data.reference]
        );

        if (paymentRes.rows.length > 0) {
            await this.handleSuccessfulPayment(paymentRes.rows[0].id, data);
        }
    }

    private async handleWebhookChargeFailed(data: PaystackWebhookEvent['data']): Promise<void> {
        const paymentRes = await pool.query(
            'SELECT * FROM community_payments WHERE paystack_reference = $1',
            [data.reference]
        );

        if (paymentRes.rows.length > 0) {
            await this.handleFailedPayment(paymentRes.rows[0].id, 'Payment failed');
        }
    }

    private async handleWebhookInvoiceFailed(data: PaystackWebhookEvent['data']): Promise<void> {
        // Find subscription by customer code
        const subRes = await pool.query(
            'SELECT * FROM community_subscriptions WHERE paystack_customer_code = $1',
            [data.customer.customer_code]
        );

        if (subRes.rows.length > 0) {
            const subscription = subRes.rows[0];

            // Update subscription status
            await pool.query(
                `UPDATE community_subscriptions SET status = 'PAST_DUE' WHERE id = $1`,
                [subscription.id]
            );

            // Get community name for notification
            const communityRes = await pool.query(
                'SELECT name FROM communities WHERE id = $1',
                [subscription.community_id]
            );

            // Notify user
            communityNotificationService.notifyPaymentFailed(
                subscription.talent_id,
                subscription.community_id,
                communityRes.rows[0]?.name || 'Communauté',
                'Le renouvellement automatique a échoué'
            ).catch(err => logger.error('Failed to notify payment failed:', err));
        }
    }

    /**
     * Handle successful payment
     */
    private async handleSuccessfulPayment(paymentId: string, paymentData: any): Promise<CommunityPayment> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update payment record
            const paymentRes = await client.query(`
                UPDATE community_payments
                SET status = 'SUCCESS',
                    paid_at = NOW(),
                    paystack_transaction_id = $1,
                    paystack_authorization_code = $2,
                    metadata = $3
                WHERE id = $4
                RETURNING *
            `, [
                paymentData.id?.toString(),
                paymentData.authorization?.authorization_code,
                JSON.stringify(paymentData),
                paymentId
            ]);

            const payment = paymentRes.rows[0];

            // Get subscription details
            const subRes = await client.query(`
                SELECT cs.*, c.name as community_name
                FROM community_subscriptions cs
                JOIN communities c ON cs.community_id = c.id
                WHERE cs.id = $1
            `, [payment.subscription_id]);

            const subscription = subRes.rows[0];

            // Renew subscription
            const subscriptionService = await getSubscriptionService();
            await subscriptionService.renewSubscription(payment.subscription_id, paymentId);

            // Create invoice
            await this.createInvoice(client, payment, subscription);

            await client.query('COMMIT');

            // Notify user
            communityNotificationService.notifyPaymentSuccess(
                subscription.talent_id,
                subscription.community_id,
                subscription.community_name,
                payment.amount,
                payment.currency
            ).catch(err => logger.error('Failed to notify payment success:', err));

            return payment;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Handle failed payment
     */
    private async handleFailedPayment(paymentId: string, reason: string): Promise<CommunityPayment> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update payment record
            const paymentRes = await client.query(`
                UPDATE community_payments
                SET status = 'FAILED',
                    failure_reason = $1,
                    retry_count = retry_count + 1,
                    next_retry_at = CASE
                        WHEN retry_count < 3 THEN NOW() + INTERVAL '1 day' * (retry_count + 1)
                        ELSE NULL
                    END
                WHERE id = $2
                RETURNING *
            `, [reason, paymentId]);

            const payment = paymentRes.rows[0];

            // Get subscription details
            const subRes = await client.query(`
                SELECT cs.*, c.name as community_name
                FROM community_subscriptions cs
                JOIN communities c ON cs.community_id = c.id
                WHERE cs.id = $1
            `, [payment.subscription_id]);

            const subscription = subRes.rows[0];

            // Update subscription status if too many failures
            if (payment.retry_count >= 3) {
                await client.query(
                    `UPDATE community_subscriptions SET status = 'PAST_DUE' WHERE id = $1`,
                    [payment.subscription_id]
                );
            }

            await client.query('COMMIT');

            // Notify user
            communityNotificationService.notifyPaymentFailed(
                subscription.talent_id,
                subscription.community_id,
                subscription.community_name,
                reason
            ).catch(err => logger.error('Failed to notify payment failed:', err));

            return payment;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Create invoice for a payment
     */
    private async createInvoice(client: any, payment: CommunityPayment, subscription: any): Promise<CommunityInvoice> {
        // Generate invoice number
        const invoiceNumberRes = await client.query(`SELECT generate_invoice_number() as invoice_number`);
        const invoiceNumber = invoiceNumberRes.rows[0].invoice_number;

        const result = await client.query(`
            INSERT INTO community_invoices (
                payment_id, subscription_id, talent_id, community_id,
                invoice_number, amount, currency, community_name,
                period_start, period_end, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PAID')
            RETURNING *
        `, [
            payment.id,
            payment.subscription_id,
            subscription.talent_id,
            subscription.community_id,
            invoiceNumber,
            payment.amount,
            payment.currency,
            subscription.community_name,
            payment.period_start,
            payment.period_end
        ]);

        return result.rows[0];
    }

    /**
     * Get payment history for a subscription
     */
    async getPaymentHistory(subscriptionId: string, talentId: string): Promise<CommunityPayment[]> {
        // Verify ownership
        const subRes = await pool.query(
            'SELECT 1 FROM community_subscriptions WHERE id = $1 AND talent_id = $2',
            [subscriptionId, talentId]
        );

        if (subRes.rows.length === 0) {
            throw new Error('Subscription not found');
        }

        const result = await pool.query(`
            SELECT * FROM community_payments
            WHERE subscription_id = $1
            ORDER BY created_at DESC
        `, [subscriptionId]);

        return result.rows;
    }

    /**
     * Get invoices for a user
     */
    async getUserInvoices(talentId: string, limit: number = 20, offset: number = 0): Promise<CommunityInvoice[]> {
        const result = await pool.query(`
            SELECT ci.*,
                   json_build_object(
                       'id', c.id,
                       'name', c.name,
                       'slug', c.slug
                   ) as community
            FROM community_invoices ci
            JOIN communities c ON ci.community_id = c.id
            WHERE ci.talent_id = $1
            ORDER BY ci.issued_at DESC
            LIMIT $2 OFFSET $3
        `, [talentId, limit, offset]);

        return result.rows;
    }

    /**
     * Get a specific invoice
     */
    async getInvoice(invoiceId: string, talentId: string): Promise<CommunityInvoice | null> {
        const result = await pool.query(`
            SELECT ci.*,
                   json_build_object(
                       'id', c.id,
                       'name', c.name,
                       'slug', c.slug
                   ) as community
            FROM community_invoices ci
            JOIN communities c ON ci.community_id = c.id
            WHERE ci.id = $1 AND ci.talent_id = $2
        `, [invoiceId, talentId]);

        return result.rows[0] || null;
    }

    /**
     * Get invoice by number
     */
    async getInvoiceByNumber(invoiceNumber: string, talentId: string): Promise<CommunityInvoice | null> {
        const result = await pool.query(`
            SELECT ci.*,
                   json_build_object(
                       'id', c.id,
                       'name', c.name,
                       'slug', c.slug,
                       'description', c.description
                   ) as community,
                   json_build_object(
                       'id', t.id,
                       'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email),
                       'email', t.email
                   ) as talent
            FROM community_invoices ci
            JOIN communities c ON ci.community_id = c.id
            JOIN talents t ON ci.talent_id = t.id
            WHERE ci.invoice_number = $1 AND ci.talent_id = $2
        `, [invoiceNumber, talentId]);

        return result.rows[0] || null;
    }

    /**
     * Process failed payments for retry (cron job)
     */
    async processFailedPaymentsRetry(): Promise<number> {
        const result = await pool.query(`
            SELECT cp.*, cs.talent_id, t.email
            FROM community_payments cp
            JOIN community_subscriptions cs ON cp.subscription_id = cs.id
            JOIN talents t ON cs.talent_id = t.id
            WHERE cp.status = 'FAILED'
              AND cp.retry_count < 3
              AND cp.next_retry_at IS NOT NULL
              AND cp.next_retry_at <= NOW()
        `);

        let retriedCount = 0;

        for (const payment of result.rows) {
            try {
                // Re-initialize payment
                await this.initializePayment({
                    subscription_id: payment.subscription_id,
                    talent_id: payment.talent_id,
                    email: payment.email
                });
                retriedCount++;
            } catch (err) {
                logger.error(`Failed to retry payment ${payment.id}:`, err);
            }
        }

        return retriedCount;
    }

    /**
     * Get community revenue stats (admin)
     */
    async getCommunityRevenueStats(communityId: string, startDate?: Date, endDate?: Date): Promise<{
        total_revenue: number,
        payment_count: number,
        successful_payments: number,
        failed_payments: number,
        average_payment: number,
        currency: string
    }> {
        let dateFilter = '';
        const params: any[] = [communityId];

        if (startDate) {
            dateFilter += ` AND cp.created_at >= $2`;
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ` AND cp.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }

        const result = await pool.query(`
            SELECT
                COALESCE(SUM(cp.amount) FILTER (WHERE cp.status = 'SUCCESS'), 0) as total_revenue,
                COUNT(*) as payment_count,
                COUNT(*) FILTER (WHERE cp.status = 'SUCCESS') as successful_payments,
                COUNT(*) FILTER (WHERE cp.status = 'FAILED') as failed_payments,
                COALESCE(AVG(cp.amount) FILTER (WHERE cp.status = 'SUCCESS'), 0) as average_payment,
                MAX(cp.currency) as currency
            FROM community_payments cp
            JOIN community_subscriptions cs ON cp.subscription_id = cs.id
            WHERE cs.community_id = $1 ${dateFilter}
        `, params);

        return result.rows[0];
    }

    /**
     * Request refund (admin initiated)
     */
    async requestRefund(paymentId: string, reason: string): Promise<CommunityPayment> {
        const paymentRes = await pool.query(
            'SELECT * FROM community_payments WHERE id = $1 AND status = $2',
            [paymentId, 'SUCCESS']
        );

        if (paymentRes.rows.length === 0) {
            throw new Error('Payment not found or not refundable');
        }

        const payment = paymentRes.rows[0];

        // Note: Manual refund - Paystack API refund not implemented yet
        // Mark as refunded in database (actual Paystack refund must be done via dashboard)
        const result = await pool.query(`
            UPDATE community_payments
            SET status = 'REFUNDED',
                metadata = metadata || $1
            WHERE id = $2
            RETURNING *
        `, [JSON.stringify({ refund_reason: reason, refunded_at: new Date() }), paymentId]);

        return result.rows[0];
    }
}

export const communityPaymentService = new CommunityPaymentService();
