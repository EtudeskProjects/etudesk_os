import { PoolClient } from 'pg';
import { pool } from '../database';
import { BillingScope } from './credit.service';

interface CreateInvoiceParams {
  scope: BillingScope;
  ownerId: string;
  amountFcfa: number;
  credits: number;
  paymentId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  paidAt?: string | Date;
}

function currentYear(): string {
  return new Date().getUTCFullYear().toString();
}

function padSequence(sequence: number): string {
  return sequence.toString().padStart(6, '0');
}

async function nextInvoiceNumber(client: PoolClient): Promise<string> {
  const year = currentYear();
  const prefix = `ETD-${year}-`;

  const result = await client.query(
    `SELECT invoice_number
     FROM billing_invoices
     WHERE invoice_number LIKE $1
     ORDER BY invoice_number DESC
     LIMIT 1`,
    [`${prefix}%`]
  );

  const previous = result.rows[0]?.invoice_number as string | undefined;
  const previousSeq = previous ? Number(previous.replace(prefix, '')) : 0;
  const nextSeq = Number.isFinite(previousSeq) ? previousSeq + 1 : 1;

  return `${prefix}${padSequence(nextSeq)}`;
}

export async function createPaidInvoice(
  params: CreateInvoiceParams,
  existingClient?: PoolClient
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const run = async (client: PoolClient): Promise<{ invoiceId: string; invoiceNumber: string }> => {
    const {
      scope,
      ownerId,
      amountFcfa,
      credits,
      description,
      metadata,
      paidAt,
    } = params;

    const invoiceNumber = await nextInvoiceNumber(client);

    const ownerColumns = scope === 'TALENT'
      ? { talentId: ownerId, organizationId: null }
      : { talentId: null, organizationId: ownerId };

    const invoiceInsert = await client.query(
      `INSERT INTO billing_invoices (
        invoice_number, scope, talent_id, organization_id,
        status, currency, subtotal_fcfa, tax_fcfa, total_fcfa,
        issued_at, paid_at, metadata
      ) VALUES (
        $1, $2, $3, $4,
        'PAID', 'FCFA', $5, 0, $5,
        NOW(), $6, $7
      ) RETURNING id`,
      [
        invoiceNumber,
        scope,
        ownerColumns.talentId,
        ownerColumns.organizationId,
        amountFcfa,
        paidAt ? new Date(paidAt) : new Date(),
        JSON.stringify(metadata ?? {}),
      ]
    );

    const invoiceId = invoiceInsert.rows[0].id as string;

    await client.query(
      `INSERT INTO billing_invoice_items (
        invoice_id, description, quantity, unit_price_fcfa, line_total_fcfa, credits, metadata
      ) VALUES (
        $1, $2, 1, $3, $3, $4, $5
      )`,
      [
        invoiceId,
        description ?? `Pack crédits ${scope === 'TALENT' ? 'Talent' : 'Organisation'} ${amountFcfa} FCFA`,
        amountFcfa,
        credits,
        JSON.stringify({ paymentId: params.paymentId ?? null }),
      ]
    );

    return { invoiceId, invoiceNumber };
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

interface GetInvoicesParams {
  scope: BillingScope;
  ownerId: string;
  limit?: number;
}

export async function getInvoices({ scope, ownerId, limit = 20 }: GetInvoicesParams): Promise<any[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const ownerColumn = scope === 'TALENT' ? 'talent_id' : 'organization_id';

  const result = await pool.query(
    `SELECT id, invoice_number, scope, status, currency, subtotal_fcfa, tax_fcfa, total_fcfa,
            issued_at, paid_at, due_at, created_at, updated_at
     FROM billing_invoices
     WHERE scope = $1 AND ${ownerColumn} = $2
     ORDER BY issued_at DESC
     LIMIT ${safeLimit}`,
    [scope, ownerId]
  );

  return result.rows;
}

export async function getInvoiceDetails(invoiceId: string): Promise<any | null> {
  const invoiceRes = await pool.query(
    `SELECT id, invoice_number, scope, talent_id, organization_id, status, currency,
            subtotal_fcfa, tax_fcfa, total_fcfa, issued_at, paid_at, due_at, metadata,
            created_at, updated_at
     FROM billing_invoices
     WHERE id = $1`,
    [invoiceId]
  );

  if (invoiceRes.rows.length === 0) {
    return null;
  }

  const itemsRes = await pool.query(
    `SELECT id, description, quantity, unit_price_fcfa, line_total_fcfa, credits, metadata, created_at
     FROM billing_invoice_items
     WHERE invoice_id = $1
     ORDER BY created_at ASC`,
    [invoiceId]
  );

  return {
    ...invoiceRes.rows[0],
    items: itemsRes.rows,
  };
}
