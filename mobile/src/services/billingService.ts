import { api, ApiResponse } from './api';

export type BillingScope = 'TALENT' | 'ORGANIZATION';

export interface BillingCatalogItem {
  action_code: string;
  scope: BillingScope;
  label: string;
  credits: number;
}

export interface BillingBalance {
  scope: BillingScope;
  owner_id: string;
  balance_credits: number;
  updated_at: string;
}

export interface BillingInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_fcfa: number;
  line_total_fcfa: number;
  credits?: number | null;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  scope: BillingScope;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  currency: string;
  subtotal_fcfa: number;
  tax_fcfa: number;
  total_fcfa: number;
  issued_at: string;
  paid_at?: string | null;
  items?: BillingInvoiceItem[];
}

export interface CheckoutInitPayload {
  scope: BillingScope;
  ownerId: string;
  amountFcfa: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutInitResult {
  payment_id: string;
  provider: 'PAYSTACK';
  status: string;
  amount_fcfa: number;
  credits_to_credit: number;
  paystack_reference: string;
  checkout_url: string;
}

export interface CheckoutVerifyResult {
  payment_id: string;
  status: string;
  wallet_credited: boolean;
  invoice_id: string | null;
  new_balance_credits: number | null;
}

function createIdempotencyKey(prefix: string = 'billing'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getCatalog(): Promise<ApiResponse<{ talent: BillingCatalogItem[]; organization: BillingCatalogItem[] }>> {
  return api.get('/api/billing/catalog');
}

async function getBalance(scope: BillingScope, ownerId?: string): Promise<ApiResponse<BillingBalance>> {
  const params: Record<string, string> = { scope };
  if (ownerId) {
    params.id = ownerId;
  }
  return api.get('/api/billing/balance', params);
}

async function initCheckout(payload: CheckoutInitPayload): Promise<ApiResponse<CheckoutInitResult>> {
  return api.post(
    '/api/billing/checkout/init',
    {
      scope: payload.scope,
      owner_id: payload.ownerId,
      amount_fcfa: payload.amountFcfa,
      idempotency_key: createIdempotencyKey('checkout'),
      metadata: payload.metadata || {},
    },
    {
      headers: {
        'x-idempotency-key': createIdempotencyKey('req'),
      },
    }
  );
}

async function verifyCheckout(paystackReference: string): Promise<ApiResponse<CheckoutVerifyResult>> {
  return api.post('/api/billing/checkout/verify', {
    paystack_reference: paystackReference,
  });
}

async function getInvoices(
  scope: BillingScope,
  ownerId?: string,
  limit: number = 10
): Promise<ApiResponse<BillingInvoice[]>> {
  const params: Record<string, string | number> = { scope, limit };
  if (ownerId) {
    params.id = ownerId;
  }
  return api.get('/api/billing/invoices', params);
}

async function getInvoice(invoiceId: string): Promise<ApiResponse<BillingInvoice>> {
  return api.get(`/api/billing/invoices/${invoiceId}`);
}

export const billingService = {
  getCatalog,
  getBalance,
  initCheckout,
  verifyCheckout,
  getInvoices,
  getInvoice,
};
