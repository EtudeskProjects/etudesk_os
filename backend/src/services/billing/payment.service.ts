import crypto from 'crypto';
import { pool } from '../database';
import { logger } from '../../utils';
import { BillingScope, WalletBalance, creditWallet } from './credit.service';
import { createPaidInvoice } from './invoice.service';
import { CURRENCY_CONFIG, SupportedCurrency, isSupportedCurrency, CREDIT_PACKS_XOF, CREDIT_PACKS_USD } from '../../constants';

interface InitCheckoutParams {
  scope: BillingScope;
  ownerId: string;
  actorTalentId: string;
  actorEmail: string;
  amount: number;
  currency: SupportedCurrency;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

interface VerifyCheckoutResult {
  paymentId: string;
  status: string;
  walletCredited: boolean;
  invoiceId: string | null;
  newBalanceCredits: number | null;
}

interface PaystackInitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackVerifyData {
  id?: string | number;
  reference?: string;
  amount?: number;
  status?: string;
  gateway_response?: string;
  paid_at?: string;
  channel?: string;
  authorization?: {
    authorization_code?: string;
  };
  metadata?: Record<string, unknown>;
}

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? '';
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL;

function minAmountForScope(scope: BillingScope, currency: SupportedCurrency): number {
  const config = CURRENCY_CONFIG[currency];
  return scope === 'TALENT' ? config.minTalent : config.minOrg;
}

function creditsForAmount(amount: number, currency: SupportedCurrency): number {
  // If the amount matches an advertised pack, grant exactly the pack's headline
  // `credits` (bonus is already folded into that number — it's a marketing label,
  // not an extra add-on). Otherwise fall back to the linear per-unit rate.
  // Previously the linear rate alone was used, so pack buyers silently lost the
  // advertised bonus tiers.
  const packs = currency === 'USD' ? CREDIT_PACKS_USD : CREDIT_PACKS_XOF;
  const pack = packs.find((p) => p.amount === amount);
  if (pack) {
    return Number(pack.credits.toFixed(2));
  }
  const config = CURRENCY_CONFIG[currency];
  const rawCredits = amount * config.creditsPerUnit;
  return Number(rawCredits.toFixed(2));
}

function createPaystackReference(scope: BillingScope): string {
  const token = crypto.randomBytes(6).toString('hex').toUpperCase();
  const ts = Date.now();
  return `ETD_${scope.substring(0, 3)}_${ts}_${token}`;
}

function toMinorUnits(amountFcfa: number): number {
  return Math.round(amountFcfa * 100);
}

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

function isValidEmail(email: string): boolean {
  if (!email || email.endsWith('@etudesk.local')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Resolve a valid email for Paystack checkout.
 * Priority: token email → users table → talents table.
 */
async function resolveCheckoutEmail(actorEmail: string, actorTalentId: string): Promise<{ email: string }> {
  const fromToken = normalizeEmail(actorEmail);
  if (isValidEmail(fromToken)) return { email: fromToken };

  const userRes = await pool.query(
    `SELECT email
     FROM users
     WHERE talent_id = $1
       AND deleted_at IS NULL
       AND email IS NOT NULL
       AND email NOT LIKE '%@etudesk.local'
     ORDER BY created_at DESC
     LIMIT 1`,
    [actorTalentId]
  );
  const fromUser = normalizeEmail(userRes.rows[0]?.email);
  if (isValidEmail(fromUser)) return { email: fromUser };

  const talentRes = await pool.query(
    `SELECT email
     FROM talents
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [actorTalentId]
  );
  const fromTalent = normalizeEmail(talentRes.rows[0]?.email);
  if (isValidEmail(fromTalent)) return { email: fromTalent };

  return { email: 'hello@etudesk.org' };
}

async function paystackRequest(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<any> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_NOT_CONFIGURED');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  let payload: any = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { message: responseText };
  }

  if (!response.ok || !payload?.status) {
    const message = payload?.message || `Paystack request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function initCheckout(params: InitCheckoutParams): Promise<any> {
  const {
    scope,
    ownerId,
    actorTalentId,
    actorEmail,
    amount,
    currency,
    idempotencyKey,
    metadata,
  } = params;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  const minAmount = minAmountForScope(scope, currency);
  if (amount < minAmount) {
    throw new Error(`Minimum amount is ${minAmount} ${currency} for ${scope}`);
  }

  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw new Error('idempotency_key is required');
  }

  const existing = await pool.query(
    `SELECT * FROM billing_payments WHERE idempotency_key = $1`,
    [idempotencyKey]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const { email: checkoutEmail } = await resolveCheckoutEmail(actorEmail, actorTalentId);
  const creditsToCredit = creditsForAmount(amount, currency);
  const reference = createPaystackReference(scope);
  const currencyConfig = CURRENCY_CONFIG[currency];

  const ownerColumns = scope === 'TALENT'
    ? { talentId: ownerId, organizationId: null }
    : { talentId: null, organizationId: ownerId };

  // Store amount in both amount and amount_fcfa (backward compat)
  const amountFcfa = currency === 'XOF' ? amount : null;

  const paymentInsert = await pool.query(
    `INSERT INTO billing_payments (
      scope, talent_id, organization_id, provider, status,
      amount, amount_fcfa, currency, credits_to_credit, paystack_reference,
      idempotency_key, metadata, created_by
    ) VALUES (
      $1, $2, $3, 'PAYSTACK', 'INITIATED',
      $4, $5, $6, $7, $8,
      $9, $10, $11
    ) RETURNING *`,
    [
      scope,
      ownerColumns.talentId,
      ownerColumns.organizationId,
      amount,
      amountFcfa,
      currency,
      creditsToCredit,
      reference,
      idempotencyKey,
      JSON.stringify(metadata ?? {}),
      actorTalentId,
    ]
  );

  const payment = paymentInsert.rows[0];

  if (!PAYSTACK_SECRET_KEY) {
    await pool.query(
      `UPDATE billing_payments
       SET status = 'PENDING',
           checkout_url = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [`https://checkout.paystack.com/mock/${reference}`, payment.id]
    );

    logger.warn('PAYSTACK_SECRET_KEY missing: using mock checkout url', {
      paymentId: payment.id,
      reference,
    });

    return {
      ...payment,
      status: 'PENDING',
      checkout_url: `https://checkout.paystack.com/mock/${reference}`,
    };
  }

  const paystackPayload: Record<string, unknown> = {
    email: checkoutEmail,
    amount: toMinorUnits(amount),
    reference,
    currency: currencyConfig.paystackCurrency,
    metadata: {
      scope,
      ownerId,
      actorTalentId,
      etudeskPaymentId: payment.id,
      originalCurrency: currency,
      ...metadata,
    },
  };

  if (PAYSTACK_CALLBACK_URL) {
    paystackPayload.callback_url = PAYSTACK_CALLBACK_URL;
  }

  let initResponse: any;
  try {
    initResponse = await paystackRequest(
      '/transaction/initialize',
      'POST',
      paystackPayload
    );
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }

    logger.warn('Paystack initialize failed in non-production, using mock checkout URL', {
      paymentId: payment.id,
      reference,
      reason: String(error?.message || error),
    });

    await pool.query(
      `UPDATE billing_payments
       SET status = 'PENDING',
           checkout_url = $1,
           metadata = metadata || $2::jsonb,
           updated_at = NOW()
       WHERE id = $3`,
      [
        `https://checkout.paystack.com/mock/${reference}`,
        JSON.stringify({ paystackInitError: String(error?.message || error) }),
        payment.id,
      ]
    );

    return {
      ...payment,
      status: 'PENDING',
      checkout_url: `https://checkout.paystack.com/mock/${reference}`,
      paystack_reference: reference,
    };
  }

  const data = initResponse.data as PaystackInitializeResult;

  await pool.query(
    `UPDATE billing_payments
     SET status = 'PENDING',
         checkout_url = $1,
         paystack_reference = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [data.authorization_url, data.reference || reference, payment.id]
  );

  return {
    ...payment,
    status: 'PENDING',
    checkout_url: data.authorization_url,
    paystack_reference: data.reference || reference,
  };
}

async function applySuccessfulPayment(
  paymentId: string,
  paystackData: PaystackVerifyData,
  source: 'VERIFY' | 'WEBHOOK'
): Promise<VerifyCheckoutResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT * FROM billing_payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (paymentRes.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentRes.rows[0];

    if (payment.status === 'SUCCESS') {
      const existingInvoice = await client.query(
        `SELECT invoice_id FROM credit_ledger WHERE payment_id = $1 AND source_type = 'PURCHASE' LIMIT 1`,
        [paymentId]
      );

      const balance = await client.query(
        payment.scope === 'TALENT'
          ? `SELECT balance_credits FROM talent_credit_wallets WHERE talent_id = $1`
          : `SELECT balance_credits FROM organization_credit_wallets WHERE organization_id = $1`,
        [payment.scope === 'TALENT' ? payment.talent_id : payment.organization_id]
      );

      await client.query('COMMIT');

      return {
        paymentId,
        status: 'SUCCESS',
        walletCredited: true,
        invoiceId: existingInvoice.rows[0]?.invoice_id ?? null,
        newBalanceCredits: balance.rows[0] ? Number(balance.rows[0].balance_credits) : null,
      };
    }

    const paidAt = paystackData.paid_at ? new Date(paystackData.paid_at) : new Date();

    await client.query(
      `UPDATE billing_payments
       SET status = 'SUCCESS',
           paystack_transaction_id = $1,
           paystack_authorization_code = $2,
           metadata = metadata || $3::jsonb,
           updated_at = NOW()
       WHERE id = $4`,
      [
        paystackData.id ? String(paystackData.id) : null,
        paystackData.authorization?.authorization_code ?? null,
        JSON.stringify({
          paystackStatus: paystackData.status,
          gatewayResponse: paystackData.gateway_response,
          creditedFrom: source,
        }),
        paymentId,
      ]
    );

    const ownerId = payment.scope === 'TALENT' ? payment.talent_id : payment.organization_id;

    const invoice = await createPaidInvoice(
      {
        scope: payment.scope,
        ownerId,
        amount: Number(payment.amount),
        currency: payment.currency || 'XOF',
        credits: Number(payment.credits_to_credit),
        paymentId,
        metadata: {
          paystackReference: payment.paystack_reference,
          paystackTransactionId: paystackData.id ? String(paystackData.id) : null,
        },
        paidAt,
      },
      client
    );

    const balance = await creditWallet(
      {
        scope: payment.scope,
        ownerId,
        credits: Number(payment.credits_to_credit),
        sourceType: 'PURCHASE',
        amount: Number(payment.amount),
        currency: payment.currency || 'XOF',
        paymentId,
        invoiceId: invoice.invoiceId,
        idempotencyKey: `payment_credit_${paymentId}`,
        metadata: {
          paystackReference: payment.paystack_reference,
          paystackTransactionId: paystackData.id ? String(paystackData.id) : null,
        },
        createdBy: payment.created_by,
      },
      client
    );

    await client.query('COMMIT');

    return {
      paymentId,
      status: 'SUCCESS',
      walletCredited: true,
      invoiceId: invoice.invoiceId,
      newBalanceCredits: balance.balanceCredits,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyCheckoutByReference(paystackReference: string): Promise<VerifyCheckoutResult> {
  const paymentRes = await pool.query(
    `SELECT * FROM billing_payments WHERE paystack_reference = $1`,
    [paystackReference]
  );

  if (paymentRes.rows.length === 0) {
    throw new Error('Payment not found for reference');
  }

  const payment = paymentRes.rows[0];

  if (!PAYSTACK_SECRET_KEY) {
    // Dev fallback when Paystack is not configured.
    return applySuccessfulPayment(payment.id, {
      id: `mock_${payment.id}`,
      reference: paystackReference,
      status: 'success',
      paid_at: new Date().toISOString(),
    }, 'VERIFY');
  }

  let data: PaystackVerifyData;
  try {
    const verifyResponse = await paystackRequest(`/transaction/verify/${encodeURIComponent(paystackReference)}`, 'GET');
    data = verifyResponse.data as PaystackVerifyData;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }

    logger.warn('Paystack verify failed in non-production, applying mock success', {
      paymentId: payment.id,
      paystackReference,
      reason: String(error?.message || error),
    });

    return applySuccessfulPayment(payment.id, {
      id: `mock_${payment.id}`,
      reference: paystackReference,
      status: 'success',
      paid_at: new Date().toISOString(),
    }, 'VERIFY');
  }

  if ((data.status || '').toLowerCase() !== 'success') {
    await pool.query(
      `UPDATE billing_payments
       SET status = 'FAILED',
           metadata = metadata || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          lastVerifyStatus: data.status,
          lastVerifyGatewayResponse: data.gateway_response,
        }),
        payment.id,
      ]
    );

    return {
      paymentId: payment.id,
      status: 'FAILED',
      walletCredited: false,
      invoiceId: null,
      newBalanceCredits: null,
    };
  }

  return applySuccessfulPayment(payment.id, data, 'VERIFY');
}

function normalizePaystackEventId(payload: any): string {
  const candidates = [
    payload?.id,
    payload?.event_id,
    payload?.data?.id,
    payload?.data?.reference,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim().length > 0) {
      return String(candidate);
    }
  }

  // Fallback: generate deterministic ID from payload to avoid NULL in ON CONFLICT
  const fallback = `unknown_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return fallback;
}

export function verifyPaystackSignature(rawBody: string, signature: string | undefined): boolean {
  if (!PAYSTACK_SECRET_KEY || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
}

export async function processPaystackWebhookEvent(
  payload: any,
  eventType: string,
  signatureHash: string | undefined,
  signatureValid: boolean
): Promise<{ ignored?: boolean; result?: VerifyCheckoutResult | null }> {
  const eventId = normalizePaystackEventId(payload);

  const inserted = await pool.query(
    `INSERT INTO paystack_webhook_events (
      event_id, event_type, signature_hash, payload, processing_status
    ) VALUES (
      $1, $2, $3, $4, $5
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id`,
    [
      eventId,
      eventType,
      signatureHash ?? null,
      JSON.stringify(payload ?? {}),
      signatureValid ? 'RECEIVED' : 'FAILED',
    ]
  );

  if (inserted.rows.length === 0) {
    return { ignored: true };
  }

  const eventRowId = inserted.rows[0].id as string;

  if (!signatureValid) {
    await pool.query(
      `UPDATE paystack_webhook_events
       SET processing_status = 'FAILED',
           error_message = 'Invalid signature',
           processed_at = NOW()
       WHERE id = $1`,
      [eventRowId]
    );

    return { ignored: true, result: null };
  }

  try {
    const normalizedType = String(eventType || '').toLowerCase();
    const reference = payload?.data?.reference;

    let result: VerifyCheckoutResult | null = null;

    if ((normalizedType === 'charge.success' || normalizedType === 'transaction.success') && reference) {
      result = await verifyCheckoutByReference(String(reference));
    }

    await pool.query(
      `UPDATE paystack_webhook_events
       SET processing_status = 'PROCESSED',
           processed_at = NOW()
       WHERE id = $1`,
      [eventRowId]
    );

    return { result };
  } catch (error: any) {
    await pool.query(
      `UPDATE paystack_webhook_events
       SET processing_status = 'FAILED',
           error_message = $2,
           processed_at = NOW()
       WHERE id = $1`,
      [eventRowId, String(error?.message ?? error)]
    );

    logger.error('Failed to process Paystack webhook event', error, {
      eventType,
      eventId,
    });

    throw error;
  }
}
