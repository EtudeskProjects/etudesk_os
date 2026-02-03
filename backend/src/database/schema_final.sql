-- ═══════════════════════════════════════════════════════════════════════════════
-- ETUDESK DATABASE SCHEMA - FINAL CONSOLIDATED VERSION
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This is the authoritative, consolidated schema representing the exact current
-- state of the database. It replaces all individual migrations (001-055).
--
-- DEPRECATED TABLES (NOT INCLUDED):
--   - skills (merged into talent_skills)
--   - talent_experiences, talent_educations (removed in 051)
--   - projects, project_links, talent_projects, project_skills
--   - documents, document_skills
--   - hubs, hub_bookings, hub_skills, organization_hubs (replaced by spaces)
--   - kyc_verifications
--
-- Generated: 2026-02-03
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE document_type AS ENUM (
    'CV', 'CERTIFICATE', 'DIPLOMA', 'LICENSE', 'PORTFOLIO',
    'RECOMMENDATION_LETTER', 'TRANSCRIPT', 'PUBLICATION', 'PATENT',
    'ID_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'STUDENT_CARD',
    'PROOF_OF_ADDRESS', 'OTHER'
);

CREATE TYPE document_status AS ENUM (
    'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'VERIFIED', 'REJECTED'
);

CREATE TYPE document_category AS ENUM (
    'PROFESSIONAL', 'ACADEMIC', 'IDENTITY', 'OTHER'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: AUTHENTICATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    talent_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN', 'EMAIL_VERIFICATION')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX idx_otp_codes_valid ON otp_codes(email, expires_at) WHERE used_at IS NULL;
CREATE INDEX idx_otp_email_created ON otp_codes(email, created_at DESC) WHERE used_at IS NULL;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_is_active ON sessions(is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: TALENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE talents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    gender VARCHAR(10),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    remote_ready BOOLEAN DEFAULT FALSE,
    willing_to_relocate BOOLEAN DEFAULT FALSE,
    profile_tags TEXT[],
    goals TEXT[],
    sectors TEXT[],
    payment_methods JSONB DEFAULT '[]'::jsonb,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_talents_slug ON talents(slug);
CREATE INDEX idx_talents_email ON talents(email);
CREATE INDEX idx_talents_country ON talents(country);
CREATE INDEX idx_talents_deleted_at ON talents(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_talents_updated_at
    BEFORE UPDATE ON talents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add foreign key from users to talents
ALTER TABLE users ADD CONSTRAINT fk_users_talent
    FOREIGN KEY (talent_id) REFERENCES talents(id) ON DELETE SET NULL;
CREATE INDEX idx_users_talent_id ON users(talent_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: TALENT SKILLS (Self-contained, no separate skills table)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE talent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    proficiency_level VARCHAR(20),
    origin VARCHAR(50) DEFAULT 'declared',
    document_id UUID,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id, canonical_name)
);

CREATE INDEX idx_talent_skills_talent_id ON talent_skills(talent_id);
CREATE INDEX idx_talent_skills_canonical_name ON talent_skills(canonical_name);
CREATE INDEX idx_talent_skills_type ON talent_skills(type);
CREATE INDEX idx_talent_skills_talent ON talent_skills(talent_id, canonical_name);

CREATE TRIGGER trigger_talent_skills_updated_at
    BEFORE UPDATE ON talent_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: TALENT DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE talent_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    document_type document_type NOT NULL DEFAULT 'OTHER',
    category document_category NOT NULL DEFAULT 'OTHER',
    status document_status NOT NULL DEFAULT 'PENDING',
    processing_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    title VARCHAR(255),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_talent_documents_talent_id ON talent_documents(talent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_talent_documents_type ON talent_documents(document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_talent_documents_status ON talent_documents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_talent_documents_category ON talent_documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_talent_documents_tags ON talent_documents USING GIN(tags) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_talent_documents_updated_at
    BEFORE UPDATE ON talent_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Document limit constraint (max 20 per talent)
CREATE OR REPLACE FUNCTION check_talent_document_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM talent_documents WHERE talent_id = NEW.talent_id AND deleted_at IS NULL) >= 20 THEN
        RAISE EXCEPTION 'Document limit exceeded: A talent can have maximum 20 documents';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_document_limit
    BEFORE INSERT ON talent_documents FOR EACH ROW EXECUTE FUNCTION check_talent_document_limit();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: ORGANIZATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    types TEXT[],
    sectors TEXT[],
    size VARCHAR(50),
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    goals TEXT[],
    headquarters_city VARCHAR(100),
    headquarters_region VARCHAR(100),
    headquarters_country CHAR(2),
    headquarters_coordinates POINT,
    verification_status VARCHAR(50) DEFAULT 'CLAIMED',
    embedding VECTOR(1536),
    culture_summary TEXT,
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_types ON organizations USING GIN(types);
CREATE INDEX idx_organizations_headquarters_country ON organizations(headquarters_country);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, talent_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_talent_id ON organization_members(talent_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_org_talent ON organization_members(organization_id, talent_id, status);
CREATE INDEX idx_org_members_org_role ON organization_members(organization_id, role) WHERE status = 'ACTIVE';

CREATE TRIGGER trigger_org_members_updated_at
    BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, email, status)
);

CREATE INDEX idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX idx_org_invitations_status ON organization_invitations(status);

CREATE TRIGGER trigger_org_invitations_updated_at
    BEFORE UPDATE ON organization_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: COMMUNITIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    description TEXT,
    rules TEXT,
    application_questions TEXT[],
    access_type VARCHAR(50) DEFAULT 'PUBLIC',
    visibility VARCHAR(20) DEFAULT 'PUBLIC',
    tags JSONB,
    sectors JSONB,
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    coordinates POINT,
    cover_image_url TEXT,
    images TEXT[],
    is_paid BOOLEAN DEFAULT FALSE,
    monthly_price NUMERIC(10, 2),
    currency VARCHAR(10) DEFAULT 'XOF',
    trial_period_days INTEGER DEFAULT 0 CHECK (trial_period_days IN (0, 1, 3, 7, 30)),
    views_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    embedding VECTOR(1536),
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_type ON communities(type);
CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_country ON communities(country);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_communities_organization_id ON communities(organization_id);
CREATE INDEX idx_communities_deleted_at ON communities(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_communities_access_type ON communities(access_type);
CREATE INDEX idx_communities_tags ON communities USING GIN(tags);
CREATE INDEX idx_communities_sectors ON communities USING GIN(sectors);

CREATE TRIGGER trigger_communities_updated_at
    BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    membership_type VARCHAR(50),
    permissions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED')),
    answers JSONB,
    accepted_rules BOOLEAN DEFAULT FALSE,
    joined_at DATE DEFAULT CURRENT_DATE,
    left_at DATE,
    is_active BOOLEAN DEFAULT TRUE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(talent_id, community_id)
);

CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_community_members_is_active ON community_members(is_active);
CREATE INDEX idx_community_members_status ON community_members(status);
CREATE INDEX idx_community_members_community_talent ON community_members(community_id, talent_id, status);
CREATE INDEX idx_community_members_community_active ON community_members(community_id, created_at DESC) WHERE status = 'ACTIVE';

CREATE TRIGGER trigger_community_members_updated_at
    BEFORE UPDATE ON community_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE community_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255),
    message TEXT,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
    invitation_token VARCHAR(255) UNIQUE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_invitations_community_id ON community_invitations(community_id);
CREATE INDEX idx_community_invitations_invitee_email ON community_invitations(invitee_email);
CREATE INDEX idx_community_invitations_status ON community_invitations(status);
CREATE INDEX idx_community_invitations_token ON community_invitations(invitation_token);
CREATE INDEX idx_community_invitations_invitee_talent_id ON community_invitations(invitee_talent_id) WHERE invitee_talent_id IS NOT NULL;
CREATE INDEX idx_community_invitations_invited_by ON community_invitations(invited_by);

CREATE TRIGGER trigger_community_invitations_updated_at
    BEFORE UPDATE ON community_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: COMMUNITY ACTIVITIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE community_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('POST', 'EVENT', 'POLL')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    moderation_reason TEXT,
    reactions_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_community_activities_community_id ON community_activities(community_id);
CREATE INDEX idx_community_activities_author_id ON community_activities(author_id);
CREATE INDEX idx_community_activities_type ON community_activities(type);
CREATE INDEX idx_community_activities_created_at ON community_activities(created_at);
CREATE INDEX idx_community_activities_moderation ON community_activities(moderation_status);
CREATE INDEX idx_community_activities_community_type_deleted ON community_activities(community_id, type, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_activities_community_status ON community_activities(community_id, status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_activities_author_created ON community_activities(author_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_community_activities_updated_at
    BEFORE UPDATE ON community_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE community_activity_reactions (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'LIKE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE community_activity_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    reactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_community_comments_activity_id ON community_activity_comments(activity_id);
CREATE INDEX idx_community_comments_parent_id ON community_activity_comments(parent_id);

CREATE TRIGGER trigger_community_comments_updated_at
    BEFORE UPDATE ON community_activity_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE community_activity_bookmarks (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE community_poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    text VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    votes_count INTEGER DEFAULT 0
);

CREATE INDEX idx_poll_options_activity_id ON community_poll_options(activity_id);
CREATE INDEX idx_poll_options_activity ON community_poll_options(activity_id, order_index);

CREATE TABLE community_poll_votes (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX idx_poll_votes_option_user ON community_poll_votes(option_id, user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: COMMUNITY MONETIZATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE community_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    paystack_subscription_code VARCHAR(100),
    paystack_customer_code VARCHAR(100),
    paystack_email_token VARCHAR(100),
    paystack_plan_code VARCHAR(100),
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (community_id, talent_id)
);

CREATE INDEX idx_community_subscriptions_community ON community_subscriptions(community_id);
CREATE INDEX idx_community_subscriptions_talent ON community_subscriptions(talent_id);
CREATE INDEX idx_community_subscriptions_status ON community_subscriptions(status);
CREATE INDEX idx_community_subscriptions_expiry ON community_subscriptions(current_period_end) WHERE status IN ('ACTIVE', 'TRIAL');

CREATE TRIGGER trigger_community_subscriptions_updated_at
    BEFORE UPDATE ON community_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE community_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    paystack_reference VARCHAR(100) UNIQUE,
    paystack_transaction_id VARCHAR(100),
    paystack_authorization_code VARCHAR(100),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    failure_reason TEXT,
    failure_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_payments_subscription ON community_payments(subscription_id);
CREATE INDEX idx_community_payments_status ON community_payments(status);
CREATE INDEX idx_community_payments_reference ON community_payments(paystack_reference);

CREATE TABLE community_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES community_payments(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
    community_name VARCHAR(255) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_invoices_talent ON community_invoices(talent_id);
CREATE INDEX idx_community_invoices_subscription ON community_invoices(subscription_id);
CREATE INDEX idx_community_invoices_community ON community_invoices(community_id);
CREATE INDEX idx_community_invoices_number ON community_invoices(invoice_number);

CREATE TABLE community_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'MENTION', 'COMMENT_REPLY', 'NEW_ACTIVITY', 'EVENT_REMINDER_1D', 'EVENT_REMINDER_1H',
        'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_FAILED', 'PAYMENT_SUCCESS',
        'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED'
    )),
    activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_notifications_talent ON community_notifications(talent_id);
CREATE INDEX idx_community_notifications_community ON community_notifications(community_id);
CREATE INDEX idx_community_notifications_type ON community_notifications(type);
CREATE INDEX idx_community_notifications_unread ON community_notifications(talent_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_community_notifications_user_community ON community_notifications(talent_id, community_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: OPPORTUNITIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    contract_type VARCHAR(50),
    work_rhythm VARCHAR(50),
    summary TEXT,
    requirements TEXT,
    nice_to_have TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sectors TEXT[],
    cv_required BOOLEAN DEFAULT false,
    application_questions JSONB,
    cover_image_url TEXT,
    images TEXT[],
    attachments JSONB,
    compensation_min DECIMAL(12, 2),
    compensation_max DECIMAL(12, 2),
    currency CHAR(3),
    compensation_frequency VARCHAR(50),
    location_type VARCHAR(50),
    locations JSONB,
    visibility VARCHAR(20) DEFAULT 'PUBLIC',
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deadline TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    duration INTERVAL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    embedding VECTOR(1536),
    ideal_candidate_summary TEXT,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_opportunities_slug ON opportunities(slug);
CREATE INDEX idx_opportunities_views_count ON opportunities(views_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_type ON opportunities(type);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_location_type ON opportunities(location_type);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_visibility ON opportunities(visibility);
CREATE INDEX idx_opportunities_deleted_at ON opportunities(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_status_deadline ON opportunities(status, deadline) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_type_status ON opportunities(type, status, posted_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_opportunities_updated_at
    BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE opportunity_posters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    poster_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    poster_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50),
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(opportunity_id, poster_talent_id),
    UNIQUE(opportunity_id, poster_organization_id)
);

CREATE INDEX idx_opportunity_posters_opportunity_id ON opportunity_posters(opportunity_id);
CREATE INDEX idx_opportunity_posters_talent_id ON opportunity_posters(poster_talent_id);
CREATE INDEX idx_opportunity_posters_org_id ON opportunity_posters(poster_organization_id);

CREATE TABLE opportunity_bookmarks (
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_bookmarks_opportunity_id ON opportunity_bookmarks(opportunity_id);
CREATE INDEX idx_bookmarks_talent_opportunity ON opportunity_bookmarks(talent_id, opportunity_id);

CREATE TABLE opportunity_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED')),
    cover_letter TEXT,
    custom_answers JSONB,
    cv_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    internal_notes TEXT,
    star_rating INTEGER,
    viewed_at TIMESTAMP WITH TIME ZONE,
    interview_scheduled_at TIMESTAMP WITH TIME ZONE,
    interview_type VARCHAR(50),
    interview_location TEXT,
    interview_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_applications_talent_id ON opportunity_applications(talent_id);
CREATE INDEX idx_opportunity_applications_opportunity_id ON opportunity_applications(opportunity_id);
CREATE INDEX idx_opportunity_applications_status ON opportunity_applications(status);
CREATE INDEX idx_opportunity_applications_interview ON opportunity_applications(interview_scheduled_at) WHERE interview_scheduled_at IS NOT NULL;
CREATE INDEX idx_applications_talent_opportunity ON opportunity_applications(talent_id, opportunity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_opportunity_status ON opportunity_applications(opportunity_id, status, applied_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_talent_status ON opportunity_applications(talent_id, status, applied_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_opportunity_applications_updated_at
    BEFORE UPDATE ON opportunity_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    proposed_datetime TIMESTAMP WITH TIME ZONE,
    datetime_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_application_messages_application_id ON application_messages(application_id);
CREATE INDEX idx_application_messages_sender ON application_messages(sender_type, sender_id);
CREATE INDEX idx_application_messages_is_read ON application_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_application_messages_created_at ON application_messages(created_at);

CREATE TRIGGER trigger_application_messages_updated_at
    BEFORE UPDATE ON application_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE opportunity_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255),
    message TEXT,
    invitation_token VARCHAR(255) UNIQUE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (opportunity_id, invitee_email)
);

CREATE INDEX idx_opportunity_invitations_opportunity_id ON opportunity_invitations(opportunity_id);
CREATE INDEX idx_opportunity_invitations_invitee_email ON opportunity_invitations(invitee_email);
CREATE INDEX idx_opportunity_invitations_token ON opportunity_invitations(invitation_token);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 10: SPACES (Bookable Rooms)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    surface_m2 DECIMAL(10, 2) NOT NULL,
    capacity INTEGER NOT NULL,
    floor_number SMALLINT DEFAULT 0,
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2) DEFAULT 'CI',
    coordinates POINT,
    equipment TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    sectors TEXT[] DEFAULT '{}',
    is_accessible BOOLEAN DEFAULT false,
    accessibility_features TEXT[] DEFAULT '{}',
    accessibility_notes TEXT,
    cover_image_url TEXT,
    gallery_images TEXT[] DEFAULT '{}',
    hourly_rate DECIMAL(12, 2),
    daily_rate DECIMAL(12, 2),
    weekly_rate DECIMAL(12, 2),
    monthly_rate DECIMAL(12, 2),
    deposit_amount DECIMAL(12, 2),
    is_bookable BOOLEAN DEFAULT true,
    min_booking_hours INTEGER DEFAULT 1,
    max_booking_hours INTEGER DEFAULT 24,
    advance_booking_days INTEGER DEFAULT 30,
    cancellation_hours INTEGER DEFAULT 24,
    visibility VARCHAR(20) DEFAULT 'PUBLIC',
    booking_rules TEXT[],
    requires_approval BOOLEAN DEFAULT false,
    questions TEXT[],
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES talents(id),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_spaces_organization ON spaces(organization_id);
CREATE INDEX idx_spaces_type ON spaces(type);
CREATE INDEX idx_spaces_city ON spaces(city);
CREATE INDEX idx_spaces_country ON spaces(country);
CREATE INDEX idx_spaces_status ON spaces(status);
CREATE INDEX idx_spaces_is_bookable ON spaces(is_bookable);
CREATE INDEX idx_spaces_capacity ON spaces(capacity);
CREATE INDEX idx_spaces_visibility ON spaces(visibility);
CREATE INDEX idx_spaces_slug ON spaces(slug);
CREATE INDEX idx_spaces_deleted_at ON spaces(deleted_at);
CREATE INDEX idx_spaces_equipment ON spaces USING GIN(equipment);
CREATE INDEX idx_spaces_amenities ON spaces USING GIN(amenities);
CREATE INDEX idx_spaces_sectors ON spaces USING GIN(sectors);

CREATE TRIGGER trigger_spaces_updated_at
    BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE space_availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(space_id, day_of_week, start_time, valid_from)
);

CREATE INDEX idx_space_availabilities_space ON space_availabilities(space_id);
CREATE INDEX idx_space_availabilities_day ON space_availabilities(day_of_week);
CREATE INDEX idx_space_availabilities_active ON space_availabilities(is_active);

CREATE TRIGGER trigger_space_availabilities_updated_at
    BEFORE UPDATE ON space_availabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE space_unavailabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(50),
    notes TEXT,
    created_by UUID REFERENCES talents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_space_unavailabilities_space ON space_unavailabilities(space_id);
CREATE INDEX idx_space_unavailabilities_dates ON space_unavailabilities(start_datetime, end_datetime);

CREATE TABLE space_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    talent_id UUID NOT NULL REFERENCES talents(id),
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    purpose TEXT,
    attendees_count INTEGER,
    special_requests TEXT,
    pricing_type VARCHAR(20) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    units_count DECIMAL(5, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    deposit_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    payment_method VARCHAR(20),
    payment_reference VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING',
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by UUID REFERENCES talents(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES talents(id),
    cancellation_reason TEXT,
    refund_amount DECIMAL(12, 2),
    completed_at TIMESTAMP WITH TIME ZONE,
    rating SMALLINT,
    review TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_space_bookings_space ON space_bookings(space_id);
CREATE INDEX idx_space_bookings_organization ON space_bookings(organization_id);
CREATE INDEX idx_space_bookings_talent ON space_bookings(talent_id);
CREATE INDEX idx_space_bookings_status ON space_bookings(status);
CREATE INDEX idx_space_bookings_payment ON space_bookings(payment_status);
CREATE INDEX idx_space_bookings_dates ON space_bookings(start_datetime, end_datetime);
CREATE UNIQUE INDEX idx_space_no_double_booking ON space_bookings(space_id, start_datetime, end_datetime) WHERE status IN ('PENDING', 'CONFIRMED');

CREATE TRIGGER trigger_space_bookings_updated_at
    BEFORE UPDATE ON space_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE space_booking_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES space_bookings(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    proposed_datetime TIMESTAMP WITH TIME ZONE,
    datetime_type VARCHAR(30),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_space_booking_messages_booking ON space_booking_messages(booking_id);
CREATE INDEX idx_space_booking_messages_sender ON space_booking_messages(sender_type, sender_id);
CREATE INDEX idx_space_booking_messages_read ON space_booking_messages(is_read);
CREATE INDEX idx_space_booking_messages_created ON space_booking_messages(created_at DESC);

CREATE TRIGGER trigger_space_booking_messages_updated_at
    BEFORE UPDATE ON space_booking_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE space_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255),
    message TEXT,
    invitation_token VARCHAR(255) UNIQUE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (space_id, invitee_email)
);

CREATE INDEX idx_space_invitations_space_id ON space_invitations(space_id);
CREATE INDEX idx_space_invitations_invitee_email ON space_invitations(invitee_email);
CREATE INDEX idx_space_invitations_token ON space_invitations(invitation_token);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 11: TALENT RELATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    to_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),
    context TEXT,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_talent_id, to_talent_id)
);

CREATE INDEX idx_connections_from_talent_id ON connections(from_talent_id);
CREATE INDEX idx_connections_to_talent_id ON connections(to_talent_id);

CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    mentee_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    focus_areas TEXT[],
    started_at DATE,
    ended_at DATE,
    status VARCHAR(50),
    notes TEXT,
    UNIQUE(mentor_id, mentee_id)
);

CREATE INDEX idx_mentorships_mentor_id ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee_id ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommender_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    recommended_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    relationship VARCHAR(255),
    recommendation_text TEXT,
    highlighted_skills TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    visibility VARCHAR(50) DEFAULT 'PUBLIC',
    UNIQUE(recommender_id, recommended_id)
);

CREATE INDEX idx_recommendations_recommender_id ON recommendations(recommender_id);
CREATE INDEX idx_recommendations_recommended_id ON recommendations(recommended_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 12: NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    email_application_status BOOLEAN DEFAULT TRUE,
    email_new_message BOOLEAN DEFAULT TRUE,
    email_new_application BOOLEAN DEFAULT TRUE,
    email_interview_reminder BOOLEAN DEFAULT TRUE,
    email_marketing BOOLEAN DEFAULT FALSE,
    push_application_status BOOLEAN DEFAULT TRUE,
    push_new_message BOOLEAN DEFAULT TRUE,
    push_new_application BOOLEAN DEFAULT TRUE,
    push_interview_reminder BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id)
);

CREATE INDEX idx_notification_preferences_talent_id ON notification_preferences(talent_id);

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'APPLICATION_STATUS_CHANGED', 'NEW_MESSAGE', 'NEW_APPLICATION',
        'INTERVIEW_SCHEDULED', 'INTERVIEW_REMINDER', 'INVITATION_RECEIVED', 'SYSTEM'
    )),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent BOOLEAN DEFAULT FALSE,
    push_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_talent_id ON notifications(talent_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX idx_notifications_talent_unread ON notifications(talent_id, is_read, created_at DESC) WHERE is_read = false;

CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    device_type VARCHAR(20) CHECK (device_type IN ('ios', 'android', 'web')),
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token)
);

CREATE INDEX idx_push_tokens_talent_id ON push_tokens(talent_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 13: COPILOT (AI Assistant)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE copilot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL DEFAULT 'explore' CHECK (mode IN ('explore', 'study')),
    title VARCHAR(255),
    context JSONB DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_copilot_sessions_talent ON copilot_sessions(talent_id);
CREATE INDEX idx_copilot_sessions_talent_active ON copilot_sessions(talent_id) WHERE deleted_at IS NULL;

CREATE TABLE copilot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    output_type VARCHAR(50),
    output_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_copilot_messages_session ON copilot_messages(session_id);
CREATE INDEX idx_copilot_messages_session_created ON copilot_messages(session_id, created_at);

CREATE OR REPLACE FUNCTION update_copilot_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE copilot_sessions SET last_message_at = NEW.created_at, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_copilot_session_timestamp
    AFTER INSERT ON copilot_messages FOR EACH ROW EXECUTE FUNCTION update_copilot_session_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 14: LEARNING MEMORY (Study Mode)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE learning_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_name VARCHAR(255) NOT NULL,
    topic_slug VARCHAR(255) NOT NULL,
    parent_topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    first_studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
    total_study_time_minutes INTEGER DEFAULT 0,
    flashcards_created INTEGER DEFAULT 0,
    flashcards_reviewed INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    quizzes_passed INTEGER DEFAULT 0,
    code_exercises_completed INTEGER DEFAULT 0,
    videos_watched INTEGER DEFAULT 0,
    articles_read INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),
    best_quiz_score INTEGER,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    source_document_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id, topic_slug)
);

CREATE INDEX idx_learning_topics_talent ON learning_topics(talent_id);
CREATE INDEX idx_learning_topics_slug ON learning_topics(talent_id, topic_slug);
CREATE INDEX idx_learning_topics_mastery ON learning_topics(talent_id, mastery_level DESC);
CREATE INDEX idx_learning_topics_last_studied ON learning_topics(talent_id, last_studied_at DESC);

CREATE TABLE learning_flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE CASCADE,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    hint TEXT,
    explanation TEXT,
    tags TEXT[] DEFAULT '{}',
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interval_days DECIMAL(10,2) DEFAULT 1,
    ease_factor DECIMAL(4,2) DEFAULT 2.5 CHECK (ease_factor >= 1.3),
    repetitions INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    last_quality INTEGER CHECK (last_quality >= 0 AND last_quality <= 5),
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    source_type VARCHAR(50),
    source_document_id UUID REFERENCES talent_documents(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,
    is_suspended BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_flashcards_talent ON learning_flashcards(talent_id);
CREATE INDEX idx_learning_flashcards_topic ON learning_flashcards(topic_id);
CREATE INDEX idx_learning_flashcards_review_queue ON learning_flashcards(talent_id, next_review_at) WHERE is_suspended = FALSE AND is_archived = FALSE;
CREATE INDEX idx_learning_flashcards_due ON learning_flashcards(talent_id, next_review_at) WHERE is_suspended = FALSE AND is_archived = FALSE;

CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    activities JSONB DEFAULT '[]'::jsonb,
    flashcards_reviewed INTEGER DEFAULT 0,
    flashcards_correct INTEGER DEFAULT 0,
    quiz_questions_answered INTEGER DEFAULT 0,
    quiz_questions_correct INTEGER DEFAULT 0,
    code_exercises_attempted INTEGER DEFAULT 0,
    code_exercises_passed INTEGER DEFAULT 0,
    notes TEXT,
    mood VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_sessions_talent ON learning_sessions(talent_id);
CREATE INDEX idx_learning_sessions_date ON learning_sessions(talent_id, started_at DESC);
CREATE INDEX idx_learning_sessions_topic ON learning_sessions(topic_id);

CREATE TABLE learning_quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE CASCADE,
    session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,
    quiz_title VARCHAR(255),
    quiz_type VARCHAR(50) DEFAULT 'adaptive',
    difficulty VARCHAR(20),
    questions JSONB NOT NULL,
    total_questions INTEGER NOT NULL,
    score INTEGER NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    passing_score INTEGER DEFAULT 70,
    time_limit_seconds INTEGER,
    time_taken_seconds INTEGER,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_quiz_results_talent ON learning_quiz_results(talent_id);
CREATE INDEX idx_learning_quiz_results_topic ON learning_quiz_results(topic_id);
CREATE INDEX idx_learning_quiz_results_date ON learning_quiz_results(talent_id, completed_at DESC);

CREATE TABLE learning_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    learning_style VARCHAR(50) DEFAULT 'visual' CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading')),
    preferred_difficulty VARCHAR(20) DEFAULT 'medium' CHECK (preferred_difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    preferred_session_length INTEGER DEFAULT 25,
    daily_goal_minutes INTEGER DEFAULT 30,
    weekly_goal_minutes INTEGER DEFAULT 150,
    monthly_goal_topics INTEGER DEFAULT 4,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_study_date DATE,
    total_study_time_minutes INTEGER DEFAULT 0,
    total_topics_studied INTEGER DEFAULT 0,
    total_flashcards_reviewed INTEGER DEFAULT 0,
    total_quizzes_completed INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),
    experience_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    achievements JSONB DEFAULT '[]'::jsonb,
    badges JSONB DEFAULT '[]'::jsonb,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_time TIME DEFAULT '09:00:00',
    reminder_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    show_progress_bar BOOLEAN DEFAULT TRUE,
    show_streak_counter BOOLEAN DEFAULT TRUE,
    enable_sounds BOOLEAN DEFAULT TRUE,
    dark_mode_cards BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id)
);

CREATE TABLE learning_code_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium',
    exercise_type VARCHAR(50) DEFAULT 'implement',
    instructions TEXT NOT NULL,
    starter_code TEXT,
    user_solution TEXT,
    reference_solution TEXT,
    test_cases JSONB,
    tests_passed INTEGER DEFAULT 0,
    tests_total INTEGER DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    execution_time_ms INTEGER,
    memory_used_kb INTEGER,
    attempt_count INTEGER DEFAULT 1,
    hints_used INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_code_exercises_talent ON learning_code_exercises(talent_id);
CREATE INDEX idx_learning_code_exercises_topic ON learning_code_exercises(topic_id);
CREATE INDEX idx_learning_code_exercises_language ON learning_code_exercises(talent_id, language);

-- Learning triggers
CREATE OR REPLACE FUNCTION update_topic_flashcard_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_reviewed_at IS NOT NULL AND (OLD.last_reviewed_at IS NULL OR NEW.last_reviewed_at > OLD.last_reviewed_at) THEN
        UPDATE learning_topics SET flashcards_reviewed = flashcards_reviewed + 1, last_studied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.topic_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_topic_flashcard_stats AFTER UPDATE ON learning_flashcards FOR EACH ROW EXECUTE FUNCTION update_topic_flashcard_stats();

CREATE OR REPLACE FUNCTION update_preferences_after_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL AND NEW.duration_minutes IS NOT NULL THEN
        UPDATE learning_preferences SET total_study_time_minutes = total_study_time_minutes + NEW.duration_minutes, last_study_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE talent_id = NEW.talent_id;
        UPDATE learning_preferences SET current_streak_days = CASE WHEN last_study_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak_days + 1 WHEN last_study_date = CURRENT_DATE THEN current_streak_days ELSE 1 END, longest_streak_days = GREATEST(longest_streak_days, current_streak_days + 1) WHERE talent_id = NEW.talent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preferences_after_session AFTER UPDATE ON learning_sessions FOR EACH ROW EXECUTE FUNCTION update_preferences_after_session();

CREATE OR REPLACE FUNCTION create_default_learning_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO learning_preferences (talent_id) VALUES (NEW.id) ON CONFLICT (talent_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_learning_preferences AFTER INSERT ON talents FOR EACH ROW EXECUTE FUNCTION create_default_learning_preferences();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 15: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_space_available(p_space_id UUID, p_start TIMESTAMP WITH TIME ZONE, p_end TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
DECLARE v_conflict_count INTEGER; v_unavailable_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_conflict_count FROM space_bookings WHERE space_id = p_space_id AND status IN ('PENDING', 'CONFIRMED') AND ((start_datetime <= p_start AND end_datetime > p_start) OR (start_datetime < p_end AND end_datetime >= p_end) OR (start_datetime >= p_start AND end_datetime <= p_end));
    IF v_conflict_count > 0 THEN RETURN FALSE; END IF;
    SELECT COUNT(*) INTO v_unavailable_count FROM space_unavailabilities WHERE space_id = p_space_id AND ((start_datetime <= p_start AND end_datetime > p_start) OR (start_datetime < p_end AND end_datetime >= p_end) OR (start_datetime >= p_start AND end_datetime <= p_end));
    RETURN v_unavailable_count = 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_booking_price(p_space_id UUID, p_start TIMESTAMP WITH TIME ZONE, p_end TIMESTAMP WITH TIME ZONE)
RETURNS TABLE(pricing_type VARCHAR(20), unit_price DECIMAL(12, 2), units_count DECIMAL(5, 2), subtotal DECIMAL(12, 2), deposit DECIMAL(12, 2), total DECIMAL(12, 2)) AS $$
DECLARE v_space spaces%ROWTYPE; v_hours DECIMAL(5, 2); v_days DECIMAL(5, 2);
BEGIN
    SELECT * INTO v_space FROM spaces WHERE id = p_space_id;
    v_hours := EXTRACT(EPOCH FROM (p_end - p_start)) / 3600;
    v_days := v_hours / 24;
    IF v_days >= 28 AND v_space.monthly_rate IS NOT NULL THEN pricing_type := 'MONTHLY'; unit_price := v_space.monthly_rate; units_count := CEIL(v_days / 30);
    ELSIF v_days >= 7 AND v_space.weekly_rate IS NOT NULL THEN pricing_type := 'WEEKLY'; unit_price := v_space.weekly_rate; units_count := CEIL(v_days / 7);
    ELSIF v_days >= 1 AND v_space.daily_rate IS NOT NULL THEN pricing_type := 'DAILY'; unit_price := v_space.daily_rate; units_count := CEIL(v_days);
    ELSE pricing_type := 'HOURLY'; unit_price := COALESCE(v_space.hourly_rate, 0); units_count := CEIL(v_hours); END IF;
    subtotal := unit_price * units_count; deposit := COALESCE(v_space.deposit_amount, 0); total := subtotal + deposit;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_otps() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN DELETE FROM otp_codes WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day' OR used_at IS NOT NULL; GET DIAGNOSTICS deleted_count = ROW_COUNT; RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN UPDATE sessions SET is_active = FALSE, revoked_reason = 'EXPIRED' WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE; GET DIAGNOSTICS deleted_count = ROW_COUNT; RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_sm2_interval(p_quality INTEGER, p_repetitions INTEGER, p_ease_factor DECIMAL, p_interval DECIMAL)
RETURNS TABLE(new_interval DECIMAL, new_ease_factor DECIMAL, new_repetitions INTEGER) AS $$
DECLARE v_ease DECIMAL; v_interval DECIMAL; v_reps INTEGER;
BEGIN
    v_ease := p_ease_factor; v_interval := p_interval; v_reps := p_repetitions;
    IF p_quality < 3 THEN v_reps := 0; v_interval := 1;
    ELSE IF v_reps = 0 THEN v_interval := 1; ELSIF v_reps = 1 THEN v_interval := 6; ELSE v_interval := v_interval * v_ease; END IF; v_reps := v_reps + 1; END IF;
    v_ease := v_ease + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02)); IF v_ease < 1.3 THEN v_ease := 1.3; END IF;
    new_interval := v_interval; new_ease_factor := v_ease; new_repetitions := v_reps;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_due_flashcards(p_talent_id UUID, p_limit INTEGER DEFAULT 20, p_topic_id UUID DEFAULT NULL)
RETURNS SETOF learning_flashcards AS $$
BEGIN
    RETURN QUERY SELECT * FROM learning_flashcards WHERE talent_id = p_talent_id AND next_review_at <= CURRENT_TIMESTAMP AND is_suspended = FALSE AND is_archived = FALSE AND (p_topic_id IS NULL OR topic_id = p_topic_id) ORDER BY next_review_at ASC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_talent_document_count(p_talent_id UUID) RETURNS INTEGER AS $$
DECLARE doc_count INTEGER;
BEGIN SELECT COUNT(*) INTO doc_count FROM talent_documents WHERE talent_id = p_talent_id AND deleted_at IS NULL; RETURN doc_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_talent_upload_document(p_talent_id UUID) RETURNS BOOLEAN AS $$
BEGIN RETURN get_talent_document_count(p_talent_id) < 20;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 16: VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE VIEW active_talents AS SELECT * FROM talents WHERE deleted_at IS NULL;
CREATE VIEW active_organizations AS SELECT * FROM organizations WHERE deleted_at IS NULL;
CREATE VIEW active_communities AS SELECT * FROM communities WHERE deleted_at IS NULL;
CREATE VIEW active_opportunities AS SELECT * FROM opportunities WHERE deleted_at IS NULL;
CREATE VIEW active_spaces AS SELECT * FROM spaces WHERE deleted_at IS NULL;

CREATE VIEW open_opportunities AS SELECT * FROM opportunities WHERE deleted_at IS NULL AND status = 'OPEN' AND (deadline IS NULL OR deadline > CURRENT_TIMESTAMP);

CREATE VIEW active_users AS SELECT u.*, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.avatar_url, t.slug as talent_slug FROM users u LEFT JOIN talents t ON u.talent_id = t.id WHERE u.deleted_at IS NULL AND u.is_active = TRUE;

CREATE VIEW v_talent_documents AS SELECT td.id, td.talent_id, td.original_filename, td.stored_filename, td.mime_type, td.file_size, td.file_url, td.document_type, td.category, td.status, td.processing_error, td.processed_at, td.tags, td.title, td.description, td.is_public, td.is_verified, td.verified_at, td.verified_by, td.verification_notes, td.created_at, td.updated_at, t.first_name || ' ' || t.last_name AS talent_name, t.email AS talent_email FROM talent_documents td JOIN talents t ON t.id = td.talent_id WHERE td.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
