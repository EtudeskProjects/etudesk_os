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
--
-- Updated: 2026-04-02 (added 11 missing tables from migration 018)
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

CREATE TYPE org_document_type AS ENUM (
    'POLICY', 'CONTRACT', 'REPORT', 'BROCHURE',
    'PRESENTATION', 'CHARTER', 'LEGAL', 'OTHER'
);

CREATE TYPE org_document_category AS ENUM (
    'ADMINISTRATIVE', 'COMMERCIAL', 'LEGAL', 'OTHER'
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
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    talent_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT users_email_required CHECK (NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL)
);

CREATE UNIQUE INDEX idx_users_email_unique_active ON users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_phone_unique_active ON users(phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
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
    is_visible BOOLEAN DEFAULT TRUE,
    embedding VECTOR(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_talents_slug ON talents(slug);
CREATE INDEX idx_talents_email ON talents(email);
CREATE INDEX idx_talents_country ON talents(country);
CREATE INDEX idx_talents_phone ON talents(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_talents_deleted_at ON talents(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_talents_updated_at
    BEFORE UPDATE ON talents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add foreign key from users to talents
ALTER TABLE users ADD CONSTRAINT fk_users_talent
    FOREIGN KEY (talent_id) REFERENCES talents(id) ON DELETE SET NULL;
CREATE INDEX idx_users_talent_id ON users(talent_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: DIGITAL SKILLS REFERENTIAL (catalog backbone) + TALENT SKILLS
-- ═══════════════════════════════════════════════════════════════════════════════
-- See migration 021_skills_referential.sql. The catalog (competencies +
-- competency_edges) is the single source of truth, seeded from
-- datasets/etudesk_digital_skills/*.csv by scripts/seed-competencies.ts.
-- talent_skills is a catalog-constrained UserCompetency (EVALUATION_FRAMEWORK:
-- A/C/I/T axes, confidence, decay, levels beginner|intermediate|advanced|master).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE competencies (
    slug            VARCHAR(120) PRIMARY KEY,
    family          VARCHAR(40)  NOT NULL,
    type            VARCHAR(20)  NOT NULL
                    CHECK (type IN ('knowledge','hard_skill','soft_skill','tool_platform','language')),
    name            VARCHAR(255) NOT NULL,
    name_fr         VARCHAR(255) NOT NULL,
    catalog_version VARCHAR(20)  NOT NULL,
    embedding       vector(1024),   -- semantic resolution (seed:competency-embeddings)
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_competencies_family ON competencies(family);
CREATE INDEX idx_competencies_type   ON competencies(type);
CREATE INDEX idx_competencies_embedding ON competencies USING hnsw (embedding vector_cosine_ops);
CREATE UNIQUE INDEX uq_competencies_name    ON competencies (lower(name));
CREATE UNIQUE INDEX uq_competencies_name_fr ON competencies (lower(name_fr));
CREATE INDEX idx_competencies_name_trgm    ON competencies USING gin (lower(name)    gin_trgm_ops);
CREATE INDEX idx_competencies_name_fr_trgm ON competencies USING gin (lower(name_fr) gin_trgm_ops);

CREATE TRIGGER trigger_competencies_updated_at
    BEFORE UPDATE ON competencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE competency_edges (
    from_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE CASCADE,
    to_slug   VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE CASCADE,
    relation  VARCHAR(20)  NOT NULL CHECK (relation IN ('prerequisite','co_occurrence','sibling')),
    strength  REAL         NOT NULL CHECK (strength > 0 AND strength <= 1),
    reason    VARCHAR(64),
    PRIMARY KEY (from_slug, to_slug)
);

CREATE INDEX idx_competency_edges_from ON competency_edges(from_slug);
CREATE INDEX idx_competency_edges_to   ON competency_edges(to_slug);

CREATE TABLE talent_skills (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id         UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    competency_slug   VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    level             VARCHAR(20) NOT NULL DEFAULT 'beginner'
                      CHECK (level IN ('beginner','intermediate','advanced','master')),
    score             SMALLINT NOT NULL DEFAULT 1 CHECK (score BETWEEN 1 AND 4),
    confidence        REAL NOT NULL DEFAULT 0.30 CHECK (confidence >= 0 AND confidence <= 1),
    axis_a            SMALLINT CHECK (axis_a BETWEEN 1 AND 4),
    axis_c            SMALLINT CHECK (axis_c BETWEEN 1 AND 4),
    axis_i            SMALLINT CHECK (axis_i BETWEEN 1 AND 4),
    axis_t            SMALLINT CHECK (axis_t BETWEEN 1 AND 4),
    origin            VARCHAR(20) NOT NULL DEFAULT 'declared'
                      CHECK (origin IN ('declared','inferred','extracted','validated')),
    context           TEXT[] NOT NULL DEFAULT '{}',
    source_ref        TEXT[] NOT NULL DEFAULT '{}',
    inferred_from     TEXT[] NOT NULL DEFAULT '{}',
    evidence_hash     VARCHAR(64),
    rationale         TEXT,
    last_evidence_at  TIMESTAMP WITH TIME ZONE,
    decay_state       VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (decay_state IN ('active','stale','archived')),
    catalog_version   VARCHAR(20)  NOT NULL,
    framework_version VARCHAR(20)  NOT NULL,
    evaluated_by      VARCHAR(64),
    is_visible        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (talent_id, competency_slug)
);

CREATE INDEX idx_talent_skills_talent        ON talent_skills(talent_id);
CREATE INDEX idx_talent_skills_slug          ON talent_skills(competency_slug);
CREATE INDEX idx_talent_skills_talent_active ON talent_skills(talent_id) WHERE decay_state = 'active';

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
    is_visible BOOLEAN DEFAULT TRUE,
    embedding VECTOR(1024),
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
    permissions TEXT[] DEFAULT '{}',
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
    status VARCHAR(50) DEFAULT 'ACTIVE',
    embedding VECTOR(1024),
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
    is_draft BOOLEAN NOT NULL DEFAULT false,
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    moderation_reason TEXT,
    reactions_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
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
    embedding VECTOR(1024),
    ideal_candidate_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_opportunities_slug ON opportunities(slug);
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_applications_talent_id ON opportunity_applications(talent_id);
CREATE INDEX idx_opportunity_applications_opportunity_id ON opportunity_applications(opportunity_id);
CREATE INDEX idx_opportunity_applications_status ON opportunity_applications(status);
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
    embedding VECTOR(1024),
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
        'INTERVIEW_SCHEDULED', 'INTERVIEW_REMINDER', 'INVITATION_RECEIVED', 'SYSTEM',
        'OPPORTUNITY', 'APPLICATION', 'MESSAGE', 'SPACE', 'REMINDER', 'MEMBERSHIP', 'BOOKING',
        'MENTION', 'COMMENT_REPLY', 'NEW_ACTIVITY',
        'EVENT_REMINDER_1D', 'EVENT_REMINDER_1H', 'EVENT_REMINDER',
        'BOOKING_REMINDER', 'OPPORTUNITY_REMINDER', 'APPLICATION_REMINDER',
        'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED'
    )),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
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
CREATE INDEX idx_notifications_community_id ON notifications(community_id);
CREATE INDEX idx_notifications_activity_id ON notifications(activity_id);
CREATE INDEX idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX idx_notifications_read_at_unread ON notifications(talent_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_schedule_pending ON notifications(scheduled_for, sent_at);

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
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL DEFAULT 'explore' CHECK (mode IN ('explore', 'study', 'org')),
    title VARCHAR(255),
    context JSONB DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_copilot_sessions_talent ON copilot_sessions(talent_id);
CREATE INDEX idx_copilot_sessions_talent_active ON copilot_sessions(talent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_copilot_sessions_org ON copilot_sessions(organization_id, talent_id) WHERE deleted_at IS NULL;

CREATE TABLE copilot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
    talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    attachments JSONB,
    tool_calls JSONB,
    tool_results JSONB,
    output_type VARCHAR(50),
    output_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX idx_copilot_messages_session ON copilot_messages(session_id);
CREATE INDEX idx_copilot_messages_session_created ON copilot_messages(session_id, created_at);
CREATE INDEX idx_copilot_messages_deleted ON copilot_messages(session_id, deleted_at) WHERE deleted_at IS NULL;

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
-- SECTION 16: ORGANIZATION DOCUMENTS & TALENT CRM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE organization_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES talents(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    document_type org_document_type NOT NULL DEFAULT 'OTHER',
    category org_document_category NOT NULL DEFAULT 'OTHER',
    status document_status NOT NULL DEFAULT 'PENDING',
    processing_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    title VARCHAR(255),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_org_documents_org_id ON organization_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_documents_type ON organization_documents(document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_documents_status ON organization_documents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_documents_category ON organization_documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_documents_tags ON organization_documents USING GIN(tags) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_org_documents_updated_at
    BEFORE UPDATE ON organization_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION check_org_document_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM organization_documents WHERE organization_id = NEW.organization_id AND deleted_at IS NULL) >= 50 THEN
        RAISE EXCEPTION 'Document limit exceeded: An organization can have maximum 50 documents';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_org_document_limit
    BEFORE INSERT ON organization_documents FOR EACH ROW EXECUTE FUNCTION check_org_document_limit();

CREATE TABLE organization_talent_favorites (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    favorited_by UUID NOT NULL REFERENCES talents(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, talent_id)
);

CREATE INDEX idx_org_talent_favorites_org ON organization_talent_favorites(organization_id);
CREATE INDEX idx_org_talent_favorites_talent ON organization_talent_favorites(talent_id);

CREATE TABLE organization_talent_tag_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6B5E52',
    created_by UUID NOT NULL REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_org_tag_definitions_org ON organization_talent_tag_definitions(organization_id);

CREATE TABLE organization_talent_tag_assignments (
    tag_id UUID NOT NULL REFERENCES organization_talent_tag_definitions(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tag_id, talent_id)
);

CREATE INDEX idx_org_tag_assignments_talent ON organization_talent_tag_assignments(talent_id);
CREATE INDEX idx_org_tag_assignments_tag ON organization_talent_tag_assignments(tag_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 17: WAITLIST
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('TALENT', 'ORGANIZATION')),
    country VARCHAR(100) NOT NULL,
    contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('EMAIL')),
    contact_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_waitlist_contact ON waitlist (contact_value);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 18: KYC VERIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE kyc_verifications (
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
CREATE INDEX idx_kyc_verifications_talent_id ON kyc_verifications (talent_id);
CREATE INDEX idx_kyc_verifications_status ON kyc_verifications (status);
CREATE INDEX idx_kyc_verifications_talent_status ON kyc_verifications (talent_id, status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 19: TALENT LANGUAGES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE talent_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    language VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE'
        CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (talent_id, language)
);
CREATE INDEX idx_talent_languages_talent_id ON talent_languages (talent_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 20: CREDIT WALLETS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE talent_credit_wallets (
    talent_id UUID PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_credit_wallets (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    balance_credits NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 21: AGENDA TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE agenda_triggers (
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
CREATE INDEX idx_agenda_triggers_talent_due_at ON agenda_triggers (talent_id, due_at) WHERE scope = 'TALENT';
CREATE INDEX idx_agenda_triggers_org_due_at ON agenda_triggers (organization_id, due_at) WHERE scope = 'ORGANIZATION';
CREATE INDEX idx_agenda_triggers_status_due_at ON agenda_triggers (status, due_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 22: DAILY OBJECTIVES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE daily_objectives (
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
CREATE INDEX idx_daily_objectives_expires ON daily_objectives (expires_at);
CREATE UNIQUE INDEX idx_daily_objectives_talent_unique ON daily_objectives (talent_id)
    WHERE talent_id IS NOT NULL AND organization_id IS NULL;
CREATE UNIQUE INDEX idx_daily_objectives_org_unique ON daily_objectives (organization_id)
    WHERE organization_id IS NOT NULL AND talent_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 23: COMMUNITY & SPACE BOOKMARKS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE community_bookmarks (
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, community_id)
);
CREATE INDEX idx_community_bookmarks_community_id ON community_bookmarks (community_id);
CREATE INDEX idx_community_bookmarks_talent ON community_bookmarks (talent_id, community_id);

CREATE TABLE space_bookmarks (
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, space_id)
);
CREATE INDEX idx_space_bookmarks_space_id ON space_bookmarks (space_id);
CREATE INDEX idx_space_bookmarks_talent ON space_bookmarks (talent_id, space_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 24: COMMUNITY MEMBERSHIP MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE community_membership_messages (
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
CREATE INDEX idx_community_membership_messages_membership_id ON community_membership_messages (membership_id);
CREATE INDEX idx_community_membership_messages_created_at ON community_membership_messages (created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 25: PAYSTACK WEBHOOK EVENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE paystack_webhook_events (
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
CREATE UNIQUE INDEX idx_paystack_webhook_event_id ON paystack_webhook_events (event_id);
CREATE INDEX idx_paystack_webhook_status ON paystack_webhook_events (processing_status, received_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 26: VIEWS
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
-- ENTITY ↔ CATALOG SKILL TAGS (only catalog slugs are taggable) — migration 021
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE opportunity_skills (
    opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    requirement     VARCHAR(20) NOT NULL DEFAULT 'required'
                    CHECK (requirement IN ('required','nice_to_have')),
    weight          REAL NOT NULL DEFAULT 1.0 CHECK (weight > 0 AND weight <= 1),
    min_level       VARCHAR(20) CHECK (min_level IN ('beginner','intermediate','advanced','master')),
    PRIMARY KEY (opportunity_id, competency_slug)
);
CREATE INDEX idx_opportunity_skills_slug ON opportunity_skills(competency_slug);

CREATE TABLE community_skills (
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    role            VARCHAR(20) NOT NULL DEFAULT 'validates'
                    CHECK (role IN ('validates','topic')),
    PRIMARY KEY (community_id, competency_slug)
);
CREATE INDEX idx_community_skills_slug ON community_skills(competency_slug);

CREATE TABLE space_skills (
    space_id        UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    role            VARCHAR(20) NOT NULL DEFAULT 'validates'
                    CHECK (role IN ('validates','equipment')),
    PRIMARY KEY (space_id, competency_slug)
);
CREATE INDEX idx_space_skills_slug ON space_skills(competency_slug);


-- ═══════════════════════════════════════════════════════════════════════════════
-- BILLING & CREDITS (consolidated from migration 001 — required for fresh install)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credit_action_catalog (
    action_code VARCHAR(80) PRIMARY KEY,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
    label VARCHAR(150) NOT NULL,
    credits NUMERIC(8,2) NOT NULL CHECK (credits >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO credit_action_catalog (action_code, scope, label, credits) VALUES
    ('TALENT_ASSISTANT_EXPLORER_QUERY', 'TALENT', 'Assistant Explorer (requête)', 1),
    ('TALENT_ASSISTANT_STUDY_QUERY', 'TALENT', 'Assistant Study (requête)', 1),
    ('TALENT_DOCUMENT_GENERATION', 'TALENT', 'Génération de document', 1),
    ('TALENT_IMAGE_GENERATION', 'TALENT', 'Génération d''image', 1),
    ('TALENT_DOCUMENT_UPLOAD', 'TALENT', 'Upload de document', 1),
    ('TALENT_PROFILE_BIO_SUGGESTION', 'TALENT', 'Suggestion de bio / profil', 1),
    ('TALENT_KYC_VERIFICATION', 'TALENT', 'Vérification KYC assistée par IA', 1),
    ('TALENT_DAILY_OBJECTIVE', 'TALENT', 'Objectif journalier', 1),
    ('TALENT_SCHEDULED_TASK', 'TALENT', 'Tâche planifiée / trigger', 1),
    ('TALENT_YOUTUBE_SEARCH', 'TALENT', 'Recherche YouTube', 0),
    ('TALENT_WEB_SEARCH', 'TALENT', 'Recherche web', 0),
    ('TALENT_QUIZ_FLASHCARDS_DIAGRAMS', 'TALENT', 'Quiz / Flashcards / Diagrammes', 0),
    ('TALENT_VOICE_INSTRUCTION', 'TALENT', 'Instruction vocale', 1),
    ('TALENT_APPLY_BOOK_JOIN', 'TALENT', 'Postuler / Réserver / Adhérer', 0),
    ('ORG_ASSISTANT_MANAGER_QUERY', 'ORGANIZATION', 'Assistant Manager (requête)', 1),
    ('ORG_DOCUMENT_UPLOAD', 'ORGANIZATION', 'Upload de document', 1),
    ('ORG_DOCUMENT_GENERATION', 'ORGANIZATION', 'Génération de document', 1),
    ('ORG_DAILY_OBJECTIVE', 'ORGANIZATION', 'Objectif journalier', 1),
    ('ORG_SCHEDULED_TASK', 'ORGANIZATION', 'Tâche planifiée / trigger', 1),
    ('ORG_APPLICATION_SCORING', 'ORGANIZATION', 'Analyse et scoring d''application', 1),
    ('ORG_FORM_SUGGESTION', 'ORGANIZATION', 'Suggestion de formulaire par IA', 1),
    ('ORG_APPLICATION_RECOMMENDATION', 'ORGANIZATION', 'Recommandation de candidature par IA', 1),
    ('ORG_WEB_SEARCH', 'ORGANIZATION', 'Recherche web', 0),
    ('ORG_VOICE_INSTRUCTION', 'ORGANIZATION', 'Instruction vocale', 1),
    ('ORG_COMMUNITY_MODERATION', 'ORGANIZATION', 'Modération de contenu communauté', 0)
ON CONFLICT (action_code) DO UPDATE SET
    scope = EXCLUDED.scope,
    label = EXCLUDED.label,
    credits = EXCLUDED.credits,
    is_active = TRUE;

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
ON credit_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_ledger_scope_talent
ON credit_ledger(scope, talent_id, created_at DESC) WHERE scope = 'TALENT';
CREATE INDEX IF NOT EXISTS idx_credit_ledger_scope_org
ON credit_ledger(scope, organization_id, created_at DESC) WHERE scope = 'ORGANIZATION';
CREATE INDEX IF NOT EXISTS idx_credit_ledger_source
ON credit_ledger(source_type, created_at DESC);

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
ON billing_invoices(talent_id, issued_at DESC) WHERE talent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org
ON billing_invoices(organization_id, issued_at DESC) WHERE organization_id IS NOT NULL;

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
ON billing_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_payments_status
ON billing_payments(status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_credit_ledger_payment') THEN
    ALTER TABLE credit_ledger ADD CONSTRAINT fk_credit_ledger_payment
      FOREIGN KEY (payment_id) REFERENCES billing_payments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_credit_ledger_invoice') THEN
    ALTER TABLE credit_ledger ADD CONSTRAINT fk_credit_ledger_invoice
      FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- SHORT LINKS (URL shortener — migration 019)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  label VARCHAR(255),
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_short_links_slug ON short_links (slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_short_links_created_at ON short_links (created_at DESC);

CREATE TABLE IF NOT EXISTS short_link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  country VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_link_id ON short_link_clicks (link_id);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_clicked_at ON short_link_clicks (clicked_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA DRIFT RECONCILIATION (columns added by later migrations / patches)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE billing_invoices      ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE billing_payments      ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE credit_ledger         ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE billing_invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC;
ALTER TABLE billing_invoice_items ADD COLUMN IF NOT EXISTS line_total NUMERIC;
ALTER TABLE community_activities  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE talents               ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'fr';
ALTER TABLE users                 ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
