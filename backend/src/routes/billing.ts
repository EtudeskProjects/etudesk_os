import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';
import {
  BillingScope,
  getCatalogByScope,
  getWalletBalance,
} from '../services/billing/credit.service';
import {
  getInvoiceDetails,
  getInvoices,
} from '../services/billing/invoice.service';
import {
  initCheckout,
  processPaystackWebhookEvent,
  verifyCheckoutByReference,
  verifyPaystackSignature,
} from '../services/billing/payment.service';
import { logger } from '../utils';

const router = Router();

function parseScope(value: unknown): BillingScope | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'TALENT' || normalized === 'ORGANIZATION') {
    return normalized;
  }
  return null;
}

async function ensureOrgBillingAccess(orgId: string, talentId: string): Promise<void> {
  const member = await pool.query(
    `SELECT role, status
     FROM organization_members
     WHERE organization_id = $1 AND talent_id = $2`,
    [orgId, talentId]
  );

  if (member.rows.length === 0) {
    throw new Error('ORGANIZATION_ACCESS_DENIED');
  }

  const status = member.rows[0].status;
  const role = String(member.rows[0].role || '').toUpperCase();

  if (status !== 'ACTIVE') {
    throw new Error('ORGANIZATION_ACCESS_DENIED');
  }

  const allowedRoles = new Set(['OWNER', 'ADMIN', 'MANAGER', 'SUB_ADMIN']);
  if (!allowedRoles.has(role)) {
    throw new Error('ORGANIZATION_BILLING_ROLE_REQUIRED');
  }
}

function handleBillingAccessError(res: Response, error: unknown): Response {
  const msg = String((error as Error)?.message || 'unknown');

  if (msg === 'ORGANIZATION_ACCESS_DENIED') {
    return res.status(403).json({ error: 'Vous n\'avez pas accès à cette organisation' });
  }

  if (msg === 'ORGANIZATION_BILLING_ROLE_REQUIRED') {
    return res.status(403).json({ error: 'Rôle insuffisant pour gérer la facturation de cette organisation' });
  }

  return res.status(500).json({ error: 'Erreur interne billing' });
}

router.get('/catalog', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const catalog = await getCatalogByScope();
    res.json({ data: catalog });
  } catch (error) {
    logger.error('Failed to fetch billing catalog', error);
    res.status(500).json({ error: 'Impossible de charger le catalogue crédits' });
  }
});

router.get('/balance', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const scope = parseScope(req.query.scope);

    if (!scope) {
      return res.status(400).json({ error: 'scope requis: TALENT ou ORGANIZATION' });
    }

    if (!req.talentId) {
      return res.status(401).json({ error: 'Authentification talent requise' });
    }

    let ownerId: string;

    if (scope === 'TALENT') {
      ownerId = typeof req.query.id === 'string' ? req.query.id : req.talentId;
      if (ownerId !== req.talentId) {
        return res.status(403).json({ error: 'Accès refusé à ce wallet talent' });
      }
    } else {
      if (typeof req.query.id !== 'string' || !req.query.id) {
        return res.status(400).json({ error: 'id organisation requis pour scope ORGANIZATION' });
      }
      ownerId = req.query.id;
      await ensureOrgBillingAccess(ownerId, req.talentId);
    }

    const balance = await getWalletBalance(scope, ownerId);
    res.json({
      data: {
        scope: balance.scope,
        owner_id: balance.ownerId,
        balance_credits: balance.balanceCredits,
        updated_at: balance.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch billing balance', error);
    return handleBillingAccessError(res, error);
  }
});

// Billing credit ledger is kept in DB for accounting/audit but is not exposed via API.

router.post('/checkout/init', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId || !req.userEmail) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const scope = parseScope(req.body.scope);
    const ownerId = req.body.owner_id;
    const amountFcfa = Number(req.body.amount_fcfa);
    const idempotencyKey = typeof req.body.idempotency_key === 'string' ? req.body.idempotency_key : '';

    if (!scope) {
      return res.status(400).json({ error: 'scope requis: TALENT ou ORGANIZATION' });
    }

    if (typeof ownerId !== 'string' || ownerId.length === 0) {
      return res.status(400).json({ error: 'owner_id requis' });
    }

    if (scope === 'TALENT' && ownerId !== req.talentId) {
      return res.status(403).json({ error: 'owner_id talent invalide' });
    }

    if (scope === 'ORGANIZATION') {
      await ensureOrgBillingAccess(ownerId, req.talentId);
    }

    const payment = await initCheckout({
      scope,
      ownerId,
      actorTalentId: req.talentId,
      actorEmail: req.userEmail,
      amountFcfa,
      idempotencyKey,
      metadata: req.body.metadata,
    });

    res.status(201).json({
      data: {
        payment_id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount_fcfa: Number(payment.amount_fcfa),
        credits_to_credit: Number(payment.credits_to_credit),
        paystack_reference: payment.paystack_reference,
        checkout_url: payment.checkout_url,
      },
    });
  } catch (error: any) {
    logger.error('Failed to initialize checkout', error);

    const message = String(error?.message || 'Erreur checkout');
    if (message.includes('Minimum amount')) {
      return res.status(400).json({ error: message });
    }
    if (message.includes('idempotency_key')) {
      return res.status(400).json({ error: message });
    }

    return handleBillingAccessError(res, error);
  }
});

router.post('/checkout/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const reference = req.body.paystack_reference;
    if (typeof reference !== 'string' || reference.length === 0) {
      return res.status(400).json({ error: 'paystack_reference requis' });
    }

    const paymentOwner = await pool.query(
      `SELECT scope, talent_id, organization_id FROM billing_payments WHERE paystack_reference = $1`,
      [reference]
    );

    if (paymentOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const row = paymentOwner.rows[0];
    const scope = row.scope as BillingScope;

    if (scope === 'TALENT') {
      if (row.talent_id !== req.talentId) {
        return res.status(403).json({ error: 'Accès refusé à ce paiement' });
      }
    } else {
      await ensureOrgBillingAccess(row.organization_id, req.talentId);
    }

    const result = await verifyCheckoutByReference(reference);

    res.json({
      data: {
        payment_id: result.paymentId,
        status: result.status,
        wallet_credited: result.walletCredited,
        invoice_id: result.invoiceId,
        new_balance_credits: result.newBalanceCredits,
      },
    });
  } catch (error) {
    logger.error('Failed to verify checkout', error);
    return handleBillingAccessError(res, error);
  }
});

router.post('/webhooks/paystack', async (req: AuthRequest, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const signatureHash = Array.isArray(signature) ? signature[0] : signature;

    const rawBody = ((req as any).rawBody as string | undefined) ?? JSON.stringify(req.body ?? {});
    const signatureValid = verifyPaystackSignature(rawBody, signatureHash);

    const eventType = String(req.body?.event ?? 'unknown');

    const handled = await processPaystackWebhookEvent(
      req.body,
      eventType,
      signatureHash,
      signatureValid
    );

    if (handled.ignored) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Failed to process paystack webhook', error);
    return res.status(500).json({ ok: false });
  }
});

router.get('/invoices', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const scope = parseScope(req.query.scope);

    if (!scope) {
      return res.status(400).json({ error: 'scope requis: TALENT ou ORGANIZATION' });
    }

    let ownerId: string;

    if (scope === 'TALENT') {
      ownerId = typeof req.query.id === 'string' ? req.query.id : req.talentId;
      if (ownerId !== req.talentId) {
        return res.status(403).json({ error: 'Accès refusé aux factures talent' });
      }
    } else {
      if (typeof req.query.id !== 'string' || !req.query.id) {
        return res.status(400).json({ error: 'id organisation requis pour scope ORGANIZATION' });
      }
      ownerId = req.query.id;
      await ensureOrgBillingAccess(ownerId, req.talentId);
    }

    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    const invoices = await getInvoices({ scope, ownerId, limit });

    return res.json({ data: invoices });
  } catch (error) {
    logger.error('Failed to list invoices', error);
    return handleBillingAccessError(res, error);
  }
});

router.get('/invoices/:invoiceId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const invoice = await getInvoiceDetails(req.params.invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    if (invoice.scope === 'TALENT') {
      if (invoice.talent_id !== req.talentId) {
        return res.status(403).json({ error: 'Accès refusé à cette facture' });
      }
    } else {
      await ensureOrgBillingAccess(invoice.organization_id, req.talentId);
    }

    return res.json({ data: invoice });
  } catch (error) {
    logger.error('Failed to get invoice details', error);
    return handleBillingAccessError(res, error);
  }
});

export default router;
