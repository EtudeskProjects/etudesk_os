-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATION MEMBERS & INVITATIONS SCHEMA
-- Version: 1.0
-- ═══════════════════════════════════════════════════════════════

-- Organization Members Table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Role & Permissions
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')),
    permissions TEXT[] DEFAULT '{}',

    -- Dates
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: one membership per talent per org
    UNIQUE(organization_id, talent_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_talent_id ON organization_members(talent_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_org_members_updated_at ON organization_members;
CREATE TRIGGER trigger_org_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Organization Invitations Table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Invitation target
    email VARCHAR(255) NOT NULL,

    -- Role & Permissions to assign on acceptance
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
    permissions TEXT[] DEFAULT '{}',

    -- Token for invitation link
    token VARCHAR(255) NOT NULL UNIQUE,

    -- Inviter
    invited_by UUID REFERENCES talents(id) ON DELETE SET NULL,

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON organization_invitations(expires_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_org_invitations_updated_at ON organization_invitations;
CREATE TRIGGER trigger_org_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- KYC Verifications Table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Document info
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('ID_CARD', 'PASSPORT', 'DRIVER_LICENSE')),
    front_image_url TEXT NOT NULL,
    back_image_url TEXT,

    -- Verification status
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    rejection_reason TEXT,

    -- Verifier (admin who verified)
    verified_by UUID REFERENCES talents(id) ON DELETE SET NULL,

    -- Dates
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_id ON kyc_verifications(talent_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_kyc_verifications_updated_at ON kyc_verifications;
CREATE TRIGGER trigger_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Add contact fields to organizations if not exists
-- ═══════════════════════════════════════════════════════════════

-- Add contact_email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'contact_email') THEN
        ALTER TABLE organizations ADD COLUMN contact_email VARCHAR(255);
    END IF;
END $$;

-- Add contact_phone column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'contact_phone') THEN
        ALTER TABLE organizations ADD COLUMN contact_phone VARCHAR(50);
    END IF;
END $$;

-- Add goals column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'organizations' AND column_name = 'goals') THEN
        ALTER TABLE organizations ADD COLUMN goals TEXT[];
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Add extra profile fields to talents if not exists
-- ═══════════════════════════════════════════════════════════════

-- Add first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'talents' AND column_name = 'first_name') THEN
        ALTER TABLE talents ADD COLUMN first_name VARCHAR(100);
    END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'talents' AND column_name = 'last_name') THEN
        ALTER TABLE talents ADD COLUMN last_name VARCHAR(100);
    END IF;
END $$;

-- Add gender column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'talents' AND column_name = 'gender') THEN
        ALTER TABLE talents ADD COLUMN gender CHAR(1) CHECK (gender IN ('M', 'F', 'O'));
    END IF;
END $$;

-- Add birthday column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'talents' AND column_name = 'birthday') THEN
        ALTER TABLE talents ADD COLUMN birthday DATE;
    END IF;
END $$;
