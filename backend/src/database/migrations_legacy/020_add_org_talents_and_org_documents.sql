-- Migration 020: Add Organization Talents (CRM) and Organization Documents
-- Tables: organization_documents, organization_talent_favorites,
--         organization_talent_tag_definitions, organization_talent_tag_assignments
-- Enums: org_document_type, org_document_category

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE org_document_type AS ENUM (
    'POLICY', 'CONTRACT', 'REPORT', 'BROCHURE',
    'PRESENTATION', 'CHARTER', 'LEGAL', 'OTHER'
);

CREATE TYPE org_document_category AS ENUM (
    'ADMINISTRATIVE', 'COMMERCIAL', 'LEGAL', 'OTHER'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: organization_documents
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

-- Document limit constraint (max 50 per organization)
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: organization_talent_favorites
-- ═══════════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: organization_talent_tag_definitions
-- ═══════════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: organization_talent_tag_assignments
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE organization_talent_tag_assignments (
    tag_id UUID NOT NULL REFERENCES organization_talent_tag_definitions(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES talents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tag_id, talent_id)
);

CREATE INDEX idx_org_tag_assignments_talent ON organization_talent_tag_assignments(talent_id);
CREATE INDEX idx_org_tag_assignments_tag ON organization_talent_tag_assignments(tag_id);
