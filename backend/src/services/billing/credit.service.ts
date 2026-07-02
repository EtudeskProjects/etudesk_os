import crypto from 'crypto';
import { PoolClient, QueryResult } from 'pg';
import { pool } from '../database';

export type BillingScope = 'TALENT' | 'ORGANIZATION';

export interface WalletBalance {
  scope: BillingScope;
  ownerId: string;
  balanceCredits: number;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  scope: BillingScope;
  talent_id: string | null;
  organization_id: string | null;
  action_code: string | null;
  direction: 'CREDIT' | 'DEBIT';
  source_type: 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT' | 'REFUND' | 'EXPIRY';
  credits: string;
  amount_fcfa: string | null;
  currency: string;
  payment_id: string | null;
  invoice_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export function isInsufficientCreditsError(error: unknown): boolean {
  return String((error as any)?.message || '').includes('INSUFFICIENT_CREDITS');
}

export function buildBillingIdempotencyKey(
  headerValue: string | string[] | undefined,
  prefix: string
): string {
  const requestKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (requestKey) return `${prefix}_${requestKey}`;
  return `${prefix}_${crypto.randomUUID()}`;
}

interface GetLedgerParams {
  scope: BillingScope;
  ownerId: string;
  limit?: number;
  cursor?: string;
}

interface CreditWalletParams {
  scope: BillingScope;
  ownerId: string;
  credits: number;
  sourceType: 'PURCHASE' | 'ADJUSTMENT' | 'REFUND';
  actionCode?: string | null;
  amount?: number | null;
  currency?: string | null;
  /** @deprecated Use amount + currency instead */
  amountFcfa?: number | null;
  paymentId?: string | null;
  invoiceId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

function getWalletConfig(scope: BillingScope): { table: string; ownerColumn: string } {
  if (scope === 'TALENT') {
    return { table: 'talent_credit_wallets', ownerColumn: 'talent_id' };
  }
  return { table: 'organization_credit_wallets', ownerColumn: 'organization_id' };
}

async function ensureWalletExists(
  scope: BillingScope,
  ownerId: string,
  client?: PoolClient
): Promise<void> {
  const executor = client ?? pool;
  const { table, ownerColumn } = getWalletConfig(scope);
  // Free credits granted once per wallet on first touch. Tunable via env.
  // Lowered from 20 -> 10 to cut the multi-account faucet (each credit is real compute).
  const WELCOME_CREDITS = Number(process.env.WELCOME_CREDITS ?? 10);
  await executor.query(
    `INSERT INTO ${table} (${ownerColumn}, balance_credits, updated_at)
     VALUES ($1, ${WELCOME_CREDITS}, NOW())
     ON CONFLICT (${ownerColumn}) DO NOTHING`,
    [ownerId]
  );
}

export async function getWalletBalance(scope: BillingScope, ownerId: string): Promise<WalletBalance> {
  const { table, ownerColumn } = getWalletConfig(scope);
  await ensureWalletExists(scope, ownerId);

  const result = await pool.query(
    `SELECT balance_credits, updated_at FROM ${table} WHERE ${ownerColumn} = $1`,
    [ownerId]
  );

  return {
    scope,
    ownerId,
    balanceCredits: Number(result.rows[0]?.balance_credits ?? 0),
    updatedAt: result.rows[0]?.updated_at ?? new Date().toISOString(),
  };
}

export async function getLedgerEntries({
  scope,
  ownerId,
  limit = 50,
  cursor,
}: GetLedgerParams): Promise<{ rows: LedgerEntry[]; nextCursor: string | null }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const ownerColumn = scope === 'TALENT' ? 'talent_id' : 'organization_id';

  let query = `
    SELECT id, scope, talent_id, organization_id, action_code, direction, source_type,
           credits, amount_fcfa, currency, payment_id, invoice_id, metadata, created_by, created_at
    FROM credit_ledger
    WHERE scope = $1 AND ${ownerColumn} = $2
  `;

  const params: unknown[] = [scope, ownerId];

  if (cursor) {
    query += ` AND created_at < $3`;
    params.push(cursor);
  }

  query += ` ORDER BY created_at DESC LIMIT ${safeLimit + 1}`;

  const result = await pool.query(query, params);
  const hasMore = result.rows.length > safeLimit;
  const rows = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

  return {
    rows,
    nextCursor: hasMore ? rows[rows.length - 1]?.created_at ?? null : null,
  };
}

export async function getCatalogByScope(): Promise<{ talent: any[]; organization: any[] }> {
  const result = await pool.query(
    `SELECT action_code, scope, label, credits
     FROM credit_action_catalog
     WHERE is_active = TRUE
     ORDER BY scope, action_code`
  );

  return {
    talent: result.rows.filter((row) => row.scope === 'TALENT'),
    organization: result.rows.filter((row) => row.scope === 'ORGANIZATION'),
  };
}

export async function creditWallet(params: CreditWalletParams, existingClient?: PoolClient): Promise<WalletBalance> {
  const run = async (client: PoolClient): Promise<WalletBalance> => {
    const {
      scope,
      ownerId,
      credits,
      sourceType,
      actionCode,
      amount,
      currency,
      amountFcfa,
      paymentId,
      invoiceId,
      idempotencyKey,
      metadata,
      createdBy,
    } = params;
    const talentOwnerId = scope === 'TALENT' ? ownerId : null;
    const organizationOwnerId = scope === 'ORGANIZATION' ? ownerId : null;

    // Resolve amount and currency (backward compat with amountFcfa)
    const resolvedAmount = amount ?? amountFcfa ?? null;
    const resolvedCurrency = currency ?? (amountFcfa != null ? 'XOF' : 'XOF');

    if (credits <= 0) {
      throw new Error('credits must be > 0');
    }

    const { table, ownerColumn } = getWalletConfig(scope);

    await ensureWalletExists(scope, ownerId, client);

    const walletUpdate = await client.query(
      `UPDATE ${table}
       SET balance_credits = balance_credits + $1,
           updated_at = NOW()
       WHERE ${ownerColumn} = $2
       RETURNING balance_credits, updated_at`,
      [credits, ownerId]
    );

    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT id FROM credit_ledger WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return {
          scope,
          ownerId,
          balanceCredits: Number(walletUpdate.rows[0].balance_credits),
          updatedAt: walletUpdate.rows[0].updated_at,
        };
      }
    }

    await client.query(
      `INSERT INTO credit_ledger (
        scope, talent_id, organization_id, action_code, direction, source_type,
        credits, amount, amount_fcfa, currency, payment_id, invoice_id, idempotency_key,
        metadata, created_by
      ) VALUES (
        $1, $2, $3, $4,
        'CREDIT',
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )`,
      [
        scope,
        talentOwnerId,
        organizationOwnerId,
        actionCode ?? null,
        sourceType,
        credits,
        resolvedAmount,
        resolvedCurrency === 'XOF' ? resolvedAmount : null,
        resolvedCurrency,
        paymentId ?? null,
        invoiceId ?? null,
        idempotencyKey ?? null,
        JSON.stringify(metadata ?? {}),
        createdBy ?? null,
      ]
    );

    return {
      scope,
      ownerId,
      balanceCredits: Number(walletUpdate.rows[0].balance_credits),
      updatedAt: walletUpdate.rows[0].updated_at,
    };
  };

  if (existingClient) {
    return run(existingClient);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface DebitWalletParams {
  scope: BillingScope;
  ownerId: string;
  actionCode: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

export async function debitWalletForAction({
  scope,
  ownerId,
  actionCode,
  idempotencyKey,
  metadata,
  createdBy,
}: DebitWalletParams): Promise<WalletBalance> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const talentOwnerId = scope === 'TALENT' ? ownerId : null;
    const organizationOwnerId = scope === 'ORGANIZATION' ? ownerId : null;

    const actionRes = await client.query(
      `SELECT action_code, credits, is_active, scope
       FROM credit_action_catalog
       WHERE action_code = $1`,
      [actionCode]
    );

    if (actionRes.rows.length === 0) {
      throw new Error('Unknown action_code');
    }

    const action = actionRes.rows[0];
    if (!action.is_active) {
      throw new Error('Action is inactive');
    }
    if (action.scope !== scope) {
      throw new Error('Action scope mismatch');
    }

    const creditsToDebit = Number(action.credits);
    const { table, ownerColumn } = getWalletConfig(scope);

    await ensureWalletExists(scope, ownerId, client);

    // Zero-credit actions are allowed in the catalog (for free features).
    // We do NOT write to credit_ledger because it enforces credits > 0.
    // If you need usage analytics for free actions, add a separate usage/events table.
    if (creditsToDebit <= 0) {
      const walletRes = await client.query(
        `SELECT balance_credits, updated_at FROM ${table} WHERE ${ownerColumn} = $1`,
        [ownerId]
      );
      await client.query('COMMIT');
      return {
        scope,
        ownerId,
        balanceCredits: Number(walletRes.rows[0]?.balance_credits ?? 0),
        updatedAt: walletRes.rows[0]?.updated_at ?? new Date().toISOString(),
      };
    }

    const existingIdempotency = await client.query(
      `SELECT id FROM credit_ledger WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existingIdempotency.rows.length > 0) {
      const walletRes = await client.query(
        `SELECT balance_credits, updated_at FROM ${table} WHERE ${ownerColumn} = $1`,
        [ownerId]
      );
      await client.query('COMMIT');
      return {
        scope,
        ownerId,
        balanceCredits: Number(walletRes.rows[0].balance_credits),
        updatedAt: walletRes.rows[0].updated_at,
      };
    }

    const walletUpdate: QueryResult = await client.query(
      `UPDATE ${table}
       SET balance_credits = balance_credits - $1,
           updated_at = NOW()
       WHERE ${ownerColumn} = $2 AND balance_credits >= $1
       RETURNING balance_credits, updated_at`,
      [creditsToDebit, ownerId]
    );

    if (walletUpdate.rows.length === 0) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    await client.query(
      `INSERT INTO credit_ledger (
        scope, talent_id, organization_id, action_code, direction, source_type,
        credits, currency, idempotency_key, metadata, created_by
      ) VALUES (
        $1, $2, $3, $4,
        'DEBIT',
        'CONSUMPTION',
        $5,
        $6,
        $7,
        $8,
        $9
      )`,
      [
        scope,
        talentOwnerId,
        organizationOwnerId,
        actionCode,
        creditsToDebit,
        'CREDITS',
        idempotencyKey,
        JSON.stringify(metadata ?? {}),
        createdBy ?? null,
      ]
    );

    await client.query('COMMIT');

    return {
      scope,
      ownerId,
      balanceCredits: Number(walletUpdate.rows[0].balance_credits),
      updatedAt: walletUpdate.rows[0].updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
