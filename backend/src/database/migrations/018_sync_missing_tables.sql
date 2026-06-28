-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 018: Sync missing tables
-- ═══════════════════════════════════════════════════════════════════════════════
-- These tables exist in production but were missing from the migration chain.
-- Using IF NOT EXISTS so this is safe to run on both fresh and existing DBs.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. waitlist
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('TALENT', 'ORGANIZATION')),
    country VARCHAR(100) NOT NULL,
    contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('EMAIL')),
    contact_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_contact ON waitlist (contact_value);

-- 2. kyc_verifications
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('ID_CARD', 'PASSPORT', 'DRIVER_LICENSE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    rejection_reason TEXT,
    front_image_url TEXT NOT NULL,
    back_image_url TEXT,
    verification_score INTEGER DEFAULT 0,
    verification_details JSONB DEFAULT '{}',
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_id ON kyc_verifications (talent_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications (status);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_status ON kyc_verifications (talent_id, status);
CREATE TRIGGER trigger_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. talent_languages
CREATE TABLE IF NOT EXISTS talent_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    language VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE'
        CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (talent_id, language)
);
CREATE INDEX IF NOT EXISTS idx_talent_languages_talent_id ON talent_languages (talent_id);
CREATE TRIGGER trigger_talent_languages_updated_at
    BEFORE UPDATE ON talent_languages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. talent_credit_wallets
CREATE TABLE IF NOT EXISTS talent_credit_wallets (
    talent_id UUID PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. organization_credit_wallets
CREATE TABLE IF NOT EXISTS organization_credit_wallets (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. agenda_triggers
CREATE TABLE IF NOT EXISTS agenda_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'CANCELED')),
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CHECK (
        (scope = 'TALENT' AND talent_id IS NOT NULL AND organization_id IS NULL) OR
        (scope = 'ORGANIZATION' AND organization_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_agenda_triggers_talent_due_at ON agenda_triggers (talent_id, due_at) WHERE scope = 'TALENT';
CREATE INDEX IF NOT EXISTS idx_agenda_triggers_org_due_at ON agenda_triggers (organization_id, due_at) WHERE scope = 'ORGANIZATION';
CREATE INDEX IF NOT EXISTS idx_agenda_triggers_status_due_at ON agenda_triggers (status, due_at);
CREATE TRIGGER trigger_agenda_triggers_updated_at
    BEFORE UPDATE ON agenda_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. daily_objectives
CREATE TABLE IF NOT EXISTS daily_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (talent_id IS NOT NULL AND organization_id IS NULL) OR
        (talent_id IS NULL AND organization_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_daily_objectives_expires ON daily_objectives (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_objectives_talent_unique ON daily_objectives (talent_id)
    WHERE talent_id IS NOT NULL AND organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_objectives_org_unique ON daily_objectives (organization_id)
    WHERE organization_id IS NOT NULL AND talent_id IS NULL;

-- 8. community_bookmarks
CREATE TABLE IF NOT EXISTS community_bookmarks (
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, community_id)
);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_community_id ON community_bookmarks (community_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_talent ON community_bookmarks (talent_id, community_id);

-- 9. community_membership_messages
CREATE TABLE IF NOT EXISTS community_membership_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_id UUID NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('TALENT', 'ORGANIZATION')),
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    proposed_datetime TIMESTAMPTZ,
    datetime_type VARCHAR(50),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_membership_id ON community_membership_messages (membership_id);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_created_at ON community_membership_messages (created_at);
CREATE TRIGGER trigger_community_membership_messages_updated_at
    BEFORE UPDATE ON community_membership_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 10. space_bookmarks
CREATE TABLE IF NOT EXISTS space_bookmarks (
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_space_bookmarks_space_id ON space_bookmarks (space_id);
CREATE INDEX IF NOT EXISTS idx_space_bookmarks_talent ON space_bookmarks (talent_id, space_id);

-- 11. paystack_webhook_events
CREATE TABLE IF NOT EXISTS paystack_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(120),
    event_type VARCHAR(120) NOT NULL,
    signature_hash VARCHAR(255),
    payload JSONB NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
        CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paystack_webhook_event_id ON paystack_webhook_events (event_id);
CREATE INDEX IF NOT EXISTS idx_paystack_webhook_status ON paystack_webhook_events (processing_status, received_at DESC);
