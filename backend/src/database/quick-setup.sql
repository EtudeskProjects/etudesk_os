-- Quick setup for missing tables
-- Run with: psql -U laminebarro -d etudesk-db-dev -f quick-setup.sql

-- Enable uuid extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- USERS TABLE (for authentication)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
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

-- ═══════════════════════════════════════════════════════════════
-- OTP CODES TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'LOGIN',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- SESSIONS TABLE (JWT refresh tokens)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessions (
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

-- ═══════════════════════════════════════════════════════════════
-- TALENTS TABLE (extend if exists, create if not)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'first_name') THEN
        ALTER TABLE talents ADD COLUMN first_name VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'last_name') THEN
        ALTER TABLE talents ADD COLUMN last_name VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'gender') THEN
        ALTER TABLE talents ADD COLUMN gender CHAR(1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'birthday') THEN
        ALTER TABLE talents ADD COLUMN birthday DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'display_name') THEN
        ALTER TABLE talents ADD COLUMN display_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'bio') THEN
        ALTER TABLE talents ADD COLUMN bio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'avatar_url') THEN
        ALTER TABLE talents ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'phone') THEN
        ALTER TABLE talents ADD COLUMN phone VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'city') THEN
        ALTER TABLE talents ADD COLUMN city VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'region') THEN
        ALTER TABLE talents ADD COLUMN region VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'country') THEN
        ALTER TABLE talents ADD COLUMN country CHAR(2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'remote_ready') THEN
        ALTER TABLE talents ADD COLUMN remote_ready BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'willing_to_relocate') THEN
        ALTER TABLE talents ADD COLUMN willing_to_relocate BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'profile_tags') THEN
        ALTER TABLE talents ADD COLUMN profile_tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'goals') THEN
        ALTER TABLE talents ADD COLUMN goals TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'slug') THEN
        ALTER TABLE talents ADD COLUMN slug VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talents' AND column_name = 'deleted_at') THEN
        ALTER TABLE talents ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATIONS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    sectors TEXT[],
    size VARCHAR(50),
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    headquarters_city VARCHAR(100),
    headquarters_region VARCHAR(100),
    headquarters_country CHAR(2),
    goals TEXT[],
    verification_status VARCHAR(50) DEFAULT 'CLAIMED',
    culture_summary TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATION MEMBERS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    permissions TEXT[] DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, talent_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_talent_id ON organization_members(talent_id);

-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATION INVITATIONS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    permissions TEXT[] DEFAULT '{}',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENTS TABLE (Unified: Identity, Professional, Academic)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL,

    -- Document info
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    -- Types: ID_CARD, PASSPORT, DRIVER_LICENSE, PROOF_OF_ADDRESS (identity)
    --        CV, PORTFOLIO, RECOMMENDATION_LETTER (professional)
    --        CERTIFICATE, DIPLOMA, LICENSE, TRANSCRIPT (academic)
    --        PUBLICATION, PATENT, OTHER

    category VARCHAR(50) NOT NULL,
    -- Categories: IDENTITY, PROFESSIONAL, ACADEMIC, OTHER

    -- File storage
    file_url TEXT,
    front_image_url TEXT,  -- For identity documents
    back_image_url TEXT,   -- For identity documents
    file_hash CHAR(64),    -- SHA256 for integrity
    file_size INTEGER,
    mime_type VARCHAR(100),

    -- Metadata
    issued_by VARCHAR(255),
    issued_at DATE,
    expires_at DATE,
    credential_id VARCHAR(255),
    verification_url TEXT,

    -- Verification
    verification_status VARCHAR(50) DEFAULT 'PENDING',
    -- Status: PENDING, VERIFIED, REJECTED, EXPIRED
    rejection_reason TEXT,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Skill extraction (for CV, certificates, diplomas)
    skills_extracted BOOLEAN DEFAULT FALSE,
    skills_extracted_at TIMESTAMP WITH TIME ZONE,
    extracted_text TEXT,
    summary TEXT,

    -- Visibility
    visibility VARCHAR(50) DEFAULT 'PRIVATE',
    -- PRIVATE, SHARED (with organizations), PUBLIC

    is_primary BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT documents_type_check CHECK (
        type IN ('ID_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'PROOF_OF_ADDRESS',
                 'CV', 'PORTFOLIO', 'RECOMMENDATION_LETTER',
                 'CERTIFICATE', 'DIPLOMA', 'LICENSE', 'TRANSCRIPT',
                 'PUBLICATION', 'PATENT', 'OTHER')
    ),
    CONSTRAINT documents_category_check CHECK (
        category IN ('IDENTITY', 'PROFESSIONAL', 'ACADEMIC', 'OTHER')
    ),
    CONSTRAINT documents_status_check CHECK (
        verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')
    )
);

CREATE INDEX IF NOT EXISTS idx_documents_talent_id ON documents(talent_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_documents_identity_verified
    ON documents(talent_id, verification_status)
    WHERE category = 'IDENTITY' AND verification_status = 'VERIFIED';
CREATE INDEX IF NOT EXISTS idx_documents_skills_pending
    ON documents(created_at)
    WHERE skills_extracted = FALSE AND type IN ('CV', 'CERTIFICATE', 'DIPLOMA', 'PORTFOLIO');

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENT REQUIREMENTS TABLE (What's needed for features)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Feature that requires the document
    feature VARCHAR(100) NOT NULL,
    -- Features: MENTORING, ORGANIZATION_CREATION, PREMIUM_FEATURES,
    --           OPPORTUNITY_APPLICATION, SKILL_VERIFICATION

    -- What's required
    required_category VARCHAR(50),
    required_type VARCHAR(50),
    must_be_verified BOOLEAN DEFAULT TRUE,

    -- Description & messaging
    description_fr TEXT,
    description_en TEXT,

    -- Priority & status
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feature, required_category, required_type)
);

-- Insert default requirements
INSERT INTO document_requirements (feature, required_category, required_type, must_be_verified, description_fr, priority) VALUES
    ('MENTORING', 'IDENTITY', NULL, TRUE, 'Une pièce d''identité vérifiée est requise pour devenir mentor', 1),
    ('MENTORING', 'PROFESSIONAL', 'CV', FALSE, 'Un CV est recommandé pour les mentors', 2),
    ('ORGANIZATION_CREATION', 'IDENTITY', NULL, TRUE, 'Une pièce d''identité vérifiée est requise pour créer une organisation', 1),
    ('PREMIUM_FEATURES', 'IDENTITY', NULL, TRUE, 'Une pièce d''identité vérifiée est requise pour les fonctionnalités premium', 1),
    ('SKILL_VERIFICATION', 'ACADEMIC', 'CERTIFICATE', FALSE, 'Les certificats permettent de vérifier vos compétences', 1),
    ('SKILL_VERIFICATION', 'ACADEMIC', 'DIPLOMA', FALSE, 'Les diplômes permettent de vérifier vos compétences', 2),
    ('SKILL_VERIFICATION', 'PROFESSIONAL', 'CV', FALSE, 'Le CV permet d''extraire automatiquement vos compétences', 3)
ON CONFLICT (feature, required_category, required_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENT SKILLS TABLE (Skills extracted from documents)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    skill_id UUID,
    skill_name VARCHAR(255) NOT NULL,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_document_skills_document_id ON document_skills(document_id);

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to check if talent has verified identity
CREATE OR REPLACE FUNCTION has_verified_identity(p_talent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM documents
        WHERE talent_id = p_talent_id
          AND category = 'IDENTITY'
          AND verification_status = 'VERIFIED'
          AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check document requirements for a feature
CREATE OR REPLACE FUNCTION check_document_requirements(
    p_talent_id UUID,
    p_feature VARCHAR(100)
) RETURNS TABLE (
    requirement_id UUID,
    feature VARCHAR(100),
    required_category VARCHAR(50),
    required_type VARCHAR(50),
    must_be_verified BOOLEAN,
    description_fr TEXT,
    is_satisfied BOOLEAN,
    document_id UUID,
    document_status VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dr.id as requirement_id,
        dr.feature,
        dr.required_category,
        dr.required_type,
        dr.must_be_verified,
        dr.description_fr,
        CASE
            WHEN d.id IS NOT NULL AND (
                NOT dr.must_be_verified OR d.verification_status = 'VERIFIED'
            ) THEN TRUE
            ELSE FALSE
        END as is_satisfied,
        d.id as document_id,
        d.verification_status as document_status
    FROM document_requirements dr
    LEFT JOIN documents d ON d.talent_id = p_talent_id
        AND d.deleted_at IS NULL
        AND (
            (dr.required_type IS NOT NULL AND d.type = dr.required_type)
            OR (dr.required_type IS NULL AND d.category = dr.required_category)
        )
    WHERE dr.feature = p_feature AND dr.is_active = TRUE
    ORDER BY dr.priority;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- LEGACY KYC TABLE (keep for backward compatibility, will be deprecated)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    front_image_url TEXT NOT NULL,
    back_image_url TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    rejection_reason TEXT,
    verified_by UUID,
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_id ON kyc_verifications(talent_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);

-- ═══════════════════════════════════════════════════════════════
-- OPPORTUNITIES TABLE (if not exists)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    contract_type VARCHAR(50),
    work_rhythm VARCHAR(50),
    summary TEXT,
    requirements TEXT,
    nice_to_have TEXT,
    compensation_min DECIMAL(12, 2),
    compensation_max DECIMAL(12, 2),
    currency CHAR(3),
    compensation_frequency VARCHAR(50),
    location_type VARCHAR(50),
    locations JSONB,
    posted_at TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    duration INTERVAL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    cover_image_url TEXT,
    cv_required BOOLEAN DEFAULT false,
    application_questions JSONB,
    sectors TEXT[],
    images TEXT[],
    attachments JSONB,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    embedding VECTOR(1536),
    ideal_candidate_summary TEXT,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_opportunities_slug ON opportunities(slug);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

-- ═══════════════════════════════════════════════════════════════
-- OPPORTUNITY POSTERS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opportunity_posters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    poster_type VARCHAR(50) DEFAULT 'organization',
    poster_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    poster_talent_id UUID,
    role VARCHAR(50),
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opportunity_posters_opportunity_id ON opportunity_posters(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_posters_poster_organization_id ON opportunity_posters(poster_organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_posters_poster_talent_id ON opportunity_posters(poster_talent_id);

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITIES TABLE (if not exists)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    description TEXT,
    rules TEXT,
    application_questions TEXT[],
    access_type VARCHAR(50),
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    logo_url TEXT,
    cover_image_url TEXT,
    website_url TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_organization_id ON communities(organization_id);

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY MEMBERS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL,
    membership_type VARCHAR(50),
    role VARCHAR(50) DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(community_id, talent_id)
);

-- ═══════════════════════════════════════════════════════════════
-- HUBS TABLE (if not exists)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),
    description TEXT,
    amenities TEXT[],
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    coordinates POINT,
    access_type VARCHAR(50),
    pricing TEXT,
    capacity INTEGER,
    opening_hours JSONB,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    website_url TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    gallery_images TEXT[],
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_hubs_slug ON hubs(slug);
CREATE INDEX IF NOT EXISTS idx_hubs_organization_id ON hubs(organization_id);

-- ═══════════════════════════════════════════════════════════════
-- HUB BOOKINGS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hub_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL,
    hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE,
    booking_date TIMESTAMP WITH TIME ZONE,
    duration INTERVAL,
    status VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_hub_bookings_hub_id ON hub_bookings(hub_id);

-- ═══════════════════════════════════════════════════════════════
-- SKILLS TABLE (add missing columns if exists)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'canonical_name') THEN
        ALTER TABLE skills ADD COLUMN canonical_name VARCHAR(255);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- OPPORTUNITY SKILLS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opportunity_skills (
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    skill_id UUID,
    is_required BOOLEAN DEFAULT TRUE,
    PRIMARY KEY(opportunity_id, skill_id)
);

DO $$ BEGIN RAISE NOTICE 'Database setup complete!'; END $$;
