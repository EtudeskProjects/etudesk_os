import { api, ApiResponse } from './api';

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL' | 'PAST_DUE';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface CommunitySubscription {
    id: string;
    community_id: string;
    talent_id: string;
    status: SubscriptionStatus;
    trial_ends_at?: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    cancelled_at?: string;
    created_at: string;
    updated_at: string;
    community?: {
        id: string;
        name: string;
        monthly_price: number;
        currency: string;
    };
}

export interface CommunityPayment {
    id: string;
    subscription_id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    paystack_reference: string;
    paystack_authorization_url?: string;
    paid_at?: string;
    created_at: string;
}

export interface CommunityInvoice {
    id: string;
    invoice_number: string;
    subscription_id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: 'PAID' | 'PENDING' | 'CANCELLED';
    billing_period_start: string;
    billing_period_end: string;
    issued_at: string;
    community?: {
        id: string;
        name: string;
    };
}

export interface SubscriptionCheckResult {
    subscribed: boolean;
    subscription: CommunitySubscription | null;
}

export interface PaywallInfo {
    community_id: string;
    community_name: string;
    monthly_price: number;
    currency: string;
    subscription_status: SubscriptionStatus | null;
    expired_at: string | null;
    trial_days?: number;
}

class CommunitySubscriptionService {
    /**
     * Get all subscriptions for the current user
     */
    async getMySubscriptions(): Promise<ApiResponse<CommunitySubscription[]>> {
        return api.get('/api/community-subscriptions/my');
    }

    /**
     * Get subscription status for a specific community
     */
    async getSubscription(communityId: string): Promise<ApiResponse<SubscriptionCheckResult>> {
        return api.get(`/api/community-subscriptions/${communityId}`);
    }

    /**
     * Start a subscription (with trial if available)
     */
    async subscribe(communityId: string): Promise<ApiResponse<{
        success: boolean;
        subscription: CommunitySubscription;
        message: string;
    }>> {
        return api.post(`/api/community-subscriptions/${communityId}/subscribe`, {});
    }

    /**
     * Initialize payment for a subscription
     */
    async initializePayment(subscriptionId: string, callbackUrl?: string): Promise<ApiResponse<{
        success: boolean;
        payment_id: string;
        authorization_url: string;
        reference: string;
    }>> {
        return api.post(`/api/community-subscriptions/${subscriptionId}/pay`, {
            callback_url: callbackUrl
        });
    }

    /**
     * Verify a payment after Paystack redirect
     */
    async verifyPayment(subscriptionId: string, reference: string): Promise<ApiResponse<{
        success: boolean;
        payment: CommunityPayment;
    }>> {
        return api.get(`/api/community-subscriptions/${subscriptionId}/verify/${reference}`);
    }

    /**
     * Cancel a subscription (will remain active until period end)
     */
    async cancelSubscription(subscriptionId: string): Promise<ApiResponse<{
        success: boolean;
        subscription: CommunitySubscription;
        message: string;
    }>> {
        return api.post(`/api/community-subscriptions/${subscriptionId}/cancel`, {});
    }

    /**
     * Reactivate a cancelled or expired subscription
     */
    async reactivateSubscription(subscriptionId: string, paymentId: string): Promise<ApiResponse<{
        success: boolean;
        subscription: CommunitySubscription;
    }>> {
        return api.post(`/api/community-subscriptions/${subscriptionId}/reactivate`, {
            payment_id: paymentId
        });
    }

    /**
     * Get payment history for a subscription
     */
    async getPaymentHistory(subscriptionId: string): Promise<ApiResponse<CommunityPayment[]>> {
        return api.get(`/api/community-subscriptions/${subscriptionId}/payments`);
    }

    /**
     * Get all invoices for the current user
     */
    async getMyInvoices(limit = 50, offset = 0): Promise<ApiResponse<CommunityInvoice[]>> {
        return api.get(`/api/community-subscriptions/invoices/all?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get a specific invoice
     */
    async getInvoice(invoiceId: string): Promise<ApiResponse<CommunityInvoice>> {
        return api.get(`/api/community-subscriptions/invoices/${invoiceId}`);
    }

    /**
     * Get invoice by number
     */
    async getInvoiceByNumber(invoiceNumber: string): Promise<ApiResponse<CommunityInvoice>> {
        return api.get(`/api/community-subscriptions/invoices/number/${invoiceNumber}`);
    }
}

export const communitySubscriptionService = new CommunitySubscriptionService();
