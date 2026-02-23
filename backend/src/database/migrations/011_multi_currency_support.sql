-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 011: Multi-currency support (XOF + USD)
-- ═══════════════════════════════════════════════════════════════════════════════

-- billing_payments: add generic amount column (keep amount_fcfa for backward compat)
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
UPDATE billing_payments SET amount = amount_fcfa WHERE amount IS NULL AND amount_fcfa IS NOT NULL;

-- credit_ledger: add generic amount column
ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
UPDATE credit_ledger SET amount = amount_fcfa WHERE amount IS NULL AND amount_fcfa IS NOT NULL;

-- billing_invoices: add generic amount column
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
UPDATE billing_invoices SET amount = total_fcfa WHERE amount IS NULL AND total_fcfa IS NOT NULL;

-- billing_invoice_items: add generic unit_price and line_total columns
ALTER TABLE billing_invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);
ALTER TABLE billing_invoice_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2);
UPDATE billing_invoice_items SET unit_price = unit_price_fcfa WHERE unit_price IS NULL AND unit_price_fcfa IS NOT NULL;
UPDATE billing_invoice_items SET line_total = line_total_fcfa WHERE line_total IS NULL AND line_total_fcfa IS NOT NULL;

-- Ensure currency columns have proper defaults but allow other values
-- (existing rows already have 'FCFA' or 'XOF', both are valid)
