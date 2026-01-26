-- Migration: Community Monetization System
-- Date: 2026-01-25
-- Description: Adds subscription, payment, and invoice tables for community monetization via Paystack

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ADD TRIAL PERIOD TO COMMUNITIES
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;

-- Add check constraint for valid trial periods (0, 1, 3, 7, 30 days)
ALTER TABLE communities
DROP CONSTRAINT IF EXISTS communities_trial_period_check;

ALTER TABLE communities
ADD CONSTRAINT communities_trial_period_check
CHECK (trial_period_days IN (0, 1, 3, 7, 30));

COMMENT ON COLUMN communities.trial_period_days IS 'Free trial period in days: 0 (default), 1, 3, 7, or 30';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CREATE COMMUNITY SUBSCRIPTIONS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Status: ACTIVE, CANCELLED, EXPIRED, TRIAL, PAST_DUE
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    -- Dates
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL if no trial
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- Pricing (snapshot at subscription time)
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    -- Paystack integration
    paystack_subscription_code VARCHAR(100) DEFAULT NULL,
    paystack_customer_code VARCHAR(100) DEFAULT NULL,
    paystack_email_token VARCHAR(100) DEFAULT NULL,
    paystack_plan_code VARCHAR(100) DEFAULT NULL,

    -- Auto-renewal
    auto_renew BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One active subscription per member per community
    CONSTRAINT community_subscriptions_unique_active UNIQUE (community_id, talent_id)
);

-- Add status check constraint
ALTER TABLE community_subscriptions
DROP CONSTRAINT IF EXISTS community_subscriptions_status_check;

ALTER TABLE community_subscriptions
ADD CONSTRAINT community_subscriptions_status_check
CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_subscriptions_community
ON community_subscriptions(community_id);

CREATE INDEX IF NOT EXISTS idx_community_subscriptions_talent
ON community_subscriptions(talent_id);

CREATE INDEX IF NOT EXISTS idx_community_subscriptions_status
ON community_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_community_subscriptions_expiry
ON community_subscriptions(current_period_end)
WHERE status IN ('ACTIVE', 'TRIAL');

CREATE INDEX IF NOT EXISTS idx_community_subscriptions_paystack
ON community_subscriptions(paystack_subscription_code)
WHERE paystack_subscription_code IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_community_subscriptions_updated_at ON community_subscriptions;
CREATE TRIGGER trigger_community_subscriptions_updated_at
    BEFORE UPDATE ON community_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE community_subscriptions IS 'Monthly subscriptions for paid communities';
COMMENT ON COLUMN community_subscriptions.status IS 'ACTIVE, CANCELLED, EXPIRED, TRIAL, PAST_DUE';
COMMENT ON COLUMN community_subscriptions.trial_ends_at IS 'End date of free trial period, NULL if no trial';
COMMENT ON COLUMN community_subscriptions.auto_renew IS 'Whether subscription auto-renews at period end';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CREATE COMMUNITY PAYMENTS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,

    -- Amount
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    -- Status: PENDING, SUCCESS, FAILED, REFUNDED
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    -- Paystack integration
    paystack_reference VARCHAR(100) UNIQUE,
    paystack_transaction_id VARCHAR(100) DEFAULT NULL,
    paystack_authorization_code VARCHAR(100) DEFAULT NULL,

    -- Period covered by this payment
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Failure handling
    failure_reason TEXT DEFAULT NULL,
    failure_code VARCHAR(50) DEFAULT NULL,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- Metadata (additional info from Paystack)
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status check constraint
ALTER TABLE community_payments
DROP CONSTRAINT IF EXISTS community_payments_status_check;

ALTER TABLE community_payments
ADD CONSTRAINT community_payments_status_check
CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_payments_subscription
ON community_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_community_payments_status
ON community_payments(status);

CREATE INDEX IF NOT EXISTS idx_community_payments_reference
ON community_payments(paystack_reference)
WHERE paystack_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_payments_created
ON community_payments(created_at);

CREATE INDEX IF NOT EXISTS idx_community_payments_failed_retry
ON community_payments(next_retry_at)
WHERE status = 'FAILED' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE community_payments IS 'Payment history for community subscriptions via Paystack';
COMMENT ON COLUMN community_payments.retry_count IS 'Number of retry attempts for failed payments';
COMMENT ON COLUMN community_payments.next_retry_at IS 'Scheduled time for next retry attempt';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CREATE COMMUNITY INVOICES TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES community_payments(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Invoice number (e.g., INV-2026-00001)
    invoice_number VARCHAR(50) UNIQUE NOT NULL,

    -- Amount
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    -- Snapshot of community info at invoice time
    community_name VARCHAR(255) NOT NULL,

    -- Period covered
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- PDF storage
    pdf_url TEXT DEFAULT NULL,
    pdf_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- Status: DRAFT, ISSUED, PAID, VOID
    status VARCHAR(20) DEFAULT 'ISSUED',

    -- Timestamps
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status check constraint
ALTER TABLE community_invoices
DROP CONSTRAINT IF EXISTS community_invoices_status_check;

ALTER TABLE community_invoices
ADD CONSTRAINT community_invoices_status_check
CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_invoices_talent
ON community_invoices(talent_id);

CREATE INDEX IF NOT EXISTS idx_community_invoices_subscription
ON community_invoices(subscription_id);

CREATE INDEX IF NOT EXISTS idx_community_invoices_community
ON community_invoices(community_id);

CREATE INDEX IF NOT EXISTS idx_community_invoices_number
ON community_invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_community_invoices_issued
ON community_invoices(issued_at);

COMMENT ON TABLE community_invoices IS 'Invoices for community subscription payments, downloadable by members';
COMMENT ON COLUMN community_invoices.invoice_number IS 'Unique invoice number format: INV-YYYY-NNNNN';
COMMENT ON COLUMN community_invoices.pdf_url IS 'URL to the generated PDF invoice';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. FUNCTION TO GENERATE INVOICE NUMBER
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    sequence_part TEXT;
    next_number INTEGER;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'INV-' || year_part || '-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO next_number
    FROM community_invoices
    WHERE invoice_number LIKE 'INV-' || year_part || '-%';

    sequence_part := LPAD(next_number::TEXT, 5, '0');

    RETURN 'INV-' || year_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number() IS 'Generates unique invoice numbers in format INV-YYYY-NNNNN';
