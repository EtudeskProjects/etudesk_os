-- 019: Credit-based billing model (Talent + Organization) with Paystack payments
-- Date: 2026-02-13

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- Wallets
-- =========================

CREATE TABLE IF NOT EXISTS talent_credit_wallets (
    talent_id UUID PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_credit_wallets (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Credit action catalog
-- =========================

CREATE TABLE IF NOT EXISTS credit_action_catalog (
    action_code VARCHAR(80) PRIMARY KEY,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    label VARCHAR(150) NOT NULL,
    credits NUMERIC(8,2) NOT NULL CHECK (credits >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO credit_action_catalog (action_code, scope, label, credits) VALUES
    -- TALENTS
    ('TALENT_ASSISTANT_EXPLORER_QUERY', 'TALENT', 'Assistant Explorer (requête)', 1),
    ('TALENT_ASSISTANT_STUDY_QUERY', 'TALENT', 'Assistant Study (requête)', 0.25),
    ('TALENT_DOCUMENT_GENERATION', 'TALENT', 'Génération de document', 1),
    ('TALENT_IMAGE_GENERATION', 'TALENT', 'Génération d''image', 1),
    ('TALENT_DOCUMENT_UPLOAD', 'TALENT', 'Upload de document', 1),
    ('TALENT_DAILY_OBJECTIVE', 'TALENT', 'Objectif journalier', 1),
    ('TALENT_SCHEDULED_TASK', 'TALENT', 'Tâche planifiée / trigger', 1),
    ('TALENT_YOUTUBE_SEARCH', 'TALENT', 'Recherche YouTube', 0),
    ('TALENT_WEB_SEARCH', 'TALENT', 'Recherche web', 0),
    ('TALENT_QUIZ_FLASHCARDS_DIAGRAMS', 'TALENT', 'Quiz / Flashcards / Diagrammes', 0),
    ('TALENT_VOICE_INSTRUCTION', 'TALENT', 'Instruction vocale', 0),
    ('TALENT_APPLY_BOOK_JOIN', 'TALENT', 'Postuler / Réserver / Adhérer', 0),
    -- ORGANIZATIONS
    ('ORG_ASSISTANT_MANAGER_QUERY', 'ORGANIZATION', 'Assistant Manager (requête)', 1),
    ('ORG_DOCUMENT_UPLOAD', 'ORGANIZATION', 'Upload de document', 1),
    ('ORG_DOCUMENT_GENERATION', 'ORGANIZATION', 'Génération de document', 1),
    ('ORG_DAILY_OBJECTIVE', 'ORGANIZATION', 'Objectif journalier', 1),
    ('ORG_SCHEDULED_TASK', 'ORGANIZATION', 'Tâche planifiée / trigger', 1),
    ('ORG_APPLICATION_SCORING', 'ORGANIZATION', 'Analyse et scoring d''application', 0.5),
    ('ORG_WEB_SEARCH', 'ORGANIZATION', 'Recherche web', 0),
    ('ORG_VOICE_INSTRUCTION', 'ORGANIZATION', 'Instruction vocale', 0),
    ('ORG_COMMUNITY_MODERATION', 'ORGANIZATION', 'Modération de contenu communauté', 0)
ON CONFLICT (action_code) DO UPDATE SET
    scope = EXCLUDED.scope,
    label = EXCLUDED.label,
    credits = EXCLUDED.credits,
    is_active = TRUE;

-- =========================
-- Credit ledger
-- =========================

CREATE TABLE IF NOT EXISTS credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    action_code VARCHAR(80) REFERENCES credit_action_catalog(action_code),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'REFUND', 'EXPIRY')),
    credits NUMERIC(14,2) NOT NULL CHECK (credits > 0),
    amount_fcfa NUMERIC(14,2),
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    payment_id UUID,
    invoice_id UUID,
    idempotency_key VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_credit_ledger_owner CHECK (
      (scope = 'TALENT' AND talent_id IS NOT NULL AND organization_id IS NULL)
      OR
      (scope = 'ORGANIZATION' AND organization_id IS NOT NULL AND talent_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_idempotency
ON credit_ledger(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_scope_talent
ON credit_ledger(scope, talent_id, created_at DESC)
WHERE scope = 'TALENT';

CREATE INDEX IF NOT EXISTS idx_credit_ledger_scope_org
ON credit_ledger(scope, organization_id, created_at DESC)
WHERE scope = 'ORGANIZATION';

CREATE INDEX IF NOT EXISTS idx_credit_ledger_source
ON credit_ledger(source_type, created_at DESC);

-- =========================
-- Billing invoices
-- =========================

CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(60) NOT NULL UNIQUE,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED')),
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    subtotal_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_billing_invoice_owner CHECK (
      (scope = 'TALENT' AND talent_id IS NOT NULL AND organization_id IS NULL)
      OR
      (scope = 'ORGANIZATION' AND organization_id IS NOT NULL AND talent_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_talent
ON billing_invoices(talent_id, issued_at DESC)
WHERE talent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org
ON billing_invoices(organization_id, issued_at DESC)
WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
    credits NUMERIC(14,2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice
ON billing_invoice_items(invoice_id);

-- =========================
-- Payments + webhooks
-- =========================

CREATE TABLE IF NOT EXISTS billing_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'PAYSTACK' CHECK (provider IN ('PAYSTACK')),
    status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')),
    amount_fcfa NUMERIC(14,2) NOT NULL CHECK (amount_fcfa > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    credits_to_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    paystack_reference VARCHAR(120) UNIQUE,
    paystack_transaction_id VARCHAR(120),
    paystack_authorization_code VARCHAR(120),
    checkout_url TEXT,
    idempotency_key VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_billing_payment_owner CHECK (
      (scope = 'TALENT' AND talent_id IS NOT NULL AND organization_id IS NULL)
      OR
      (scope = 'ORGANIZATION' AND organization_id IS NOT NULL AND talent_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_idempotency
ON billing_payments(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payments_status
ON billing_payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS paystack_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(120),
    event_type VARCHAR(120) NOT NULL,
    signature_hash VARCHAR(255),
    payload JSONB NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
    error_message TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paystack_webhook_event_id
ON paystack_webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_paystack_webhook_status
ON paystack_webhook_events(processing_status, received_at DESC);

-- =========================
-- Link foreign keys after table creation
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_credit_ledger_payment'
  ) THEN
    ALTER TABLE credit_ledger
      ADD CONSTRAINT fk_credit_ledger_payment
      FOREIGN KEY (payment_id) REFERENCES billing_payments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_credit_ledger_invoice'
  ) THEN
    ALTER TABLE credit_ledger
      ADD CONSTRAINT fk_credit_ledger_invoice
      FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
