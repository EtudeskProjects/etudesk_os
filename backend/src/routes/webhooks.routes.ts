import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { communityPaymentService } from '../services/community-payment.service';

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(payload: string, signature: string): boolean {
    if (!PAYSTACK_SECRET_KEY) {
        console.error('[Webhook] PAYSTACK_SECRET_KEY not configured');
        return false;
    }

    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

    return hash === signature;
}

/**
 * POST /api/webhooks/paystack
 * Receives and processes Paystack webhook events
 */
router.post('/paystack', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-paystack-signature'] as string;
        const payload = req.body.toString();

        // Verify signature
        if (!verifyPaystackSignature(payload, signature)) {
            console.error('[Webhook] Invalid Paystack signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(payload);

        console.log(`[Webhook] Received Paystack event: ${event.event}`);
        console.log(`[Webhook] Reference: ${event.data?.reference || 'N/A'}`);

        // Process the webhook
        await communityPaymentService.handleWebhook(event);

        // Always return 200 quickly to acknowledge receipt
        res.status(200).json({ received: true });

    } catch (error: any) {
        console.error('[Webhook] Error processing Paystack webhook:', error);
        // Still return 200 to prevent Paystack from retrying
        res.status(200).json({ received: true, error: error.message });
    }
});

/**
 * GET /api/webhooks/paystack/test
 * Test endpoint to verify webhook is configured (dev only)
 */
router.get('/paystack/test', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }

    res.json({
        status: 'ok',
        message: 'Paystack webhook endpoint is configured',
        secret_configured: !!PAYSTACK_SECRET_KEY,
        webhook_url: process.env.PAYSTACK_WEBHOOK_URL
    });
});

export default router;
