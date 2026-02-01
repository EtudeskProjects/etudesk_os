-- ═══════════════════════════════════════════════════════════════
-- Migration: 042_talent_documents
-- Description: Document management system for talents
-- ═══════════════════════════════════════════════════════════════

-- Document type enum
CREATE TYPE document_type AS ENUM (
    'CV',
    'CERTIFICATE',
    'DIPLOMA',
    'LICENSE',
    'PORTFOLIO',
    'RECOMMENDATION_LETTER',
    'TRANSCRIPT',
    'PUBLICATION',
    'PATENT',
    'ID_CARD',
    'PASSPORT',
    'DRIVER_LICENSE',
    'PROOF_OF_ADDRESS',
    'OTHER'
);

-- Document status enum
CREATE TYPE document_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'VERIFIED',
    'REJECTED'
);

-- Document category enum
CREATE TYPE document_category AS ENUM (
    'PROFESSIONAL',
    'ACADEMIC',
    'IDENTITY',
    'OTHER'
);

-- ═══════════════════════════════════════════════════════════════
-- TALENT DOCUMENTS TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE talent_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- File information
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL, -- in bytes
    file_url TEXT NOT NULL,

    -- Document classification
    document_type document_type NOT NULL DEFAULT 'OTHER',
    category document_category NOT NULL DEFAULT 'OTHER',

    -- Processing status
    status document_status NOT NULL DEFAULT 'PENDING',
    processing_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Extracted metadata (from AI)
    extracted_data JSONB DEFAULT '{}'::jsonb,
    -- {
    --   title: string,
    --   issuer: string,
    --   issue_date: string,
    --   expiry_date: string,
    --   description: string,
    --   skills: string[],
    --   languages: string[],
    --   field_of_study: string,
    --   grade: string,
    --   full_name: string,
    --   document_number: string,
    --   confidence_score: number
    -- }

    -- Auto-generated tags
    tags TEXT[] DEFAULT '{}',

    -- User-provided metadata
    title VARCHAR(255), -- User can override extracted title
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Visible on public profile

    -- Verification (for KYC documents)
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Index for querying by talent
CREATE INDEX idx_talent_documents_talent_id ON talent_documents(talent_id) WHERE deleted_at IS NULL;

-- Index for filtering by type
CREATE INDEX idx_talent_documents_type ON talent_documents(document_type) WHERE deleted_at IS NULL;

-- Index for filtering by status
CREATE INDEX idx_talent_documents_status ON talent_documents(status) WHERE deleted_at IS NULL;

-- Index for filtering by category
CREATE INDEX idx_talent_documents_category ON talent_documents(category) WHERE deleted_at IS NULL;

-- GIN index for tags search
CREATE INDEX idx_talent_documents_tags ON talent_documents USING GIN(tags) WHERE deleted_at IS NULL;

-- GIN index for extracted data search
CREATE INDEX idx_talent_documents_extracted ON talent_documents USING GIN(extracted_data) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_talent_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_talent_documents_updated_at
    BEFORE UPDATE ON talent_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_talent_documents_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENT COUNT CONSTRAINT
-- Enforces max 20 documents per talent
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_talent_document_limit()
RETURNS TRIGGER AS $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count
    FROM talent_documents
    WHERE talent_id = NEW.talent_id
    AND deleted_at IS NULL;

    IF doc_count >= 20 THEN
        RAISE EXCEPTION 'Document limit exceeded: A talent can have maximum 20 documents';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_document_limit
    BEFORE INSERT ON talent_documents
    FOR EACH ROW
    EXECUTE FUNCTION check_talent_document_limit();

-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════

-- View for active documents with talent info
CREATE OR REPLACE VIEW v_talent_documents AS
SELECT
    td.*,
    t.first_name || ' ' || t.last_name AS talent_name,
    u.email AS talent_email
FROM talent_documents td
JOIN talents t ON t.id = td.talent_id
JOIN users u ON u.id = t.user_id
WHERE td.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to get document count for a talent
CREATE OR REPLACE FUNCTION get_talent_document_count(p_talent_id UUID)
RETURNS INTEGER AS $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count
    FROM talent_documents
    WHERE talent_id = p_talent_id
    AND deleted_at IS NULL;

    RETURN doc_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if talent can upload more documents
CREATE OR REPLACE FUNCTION can_talent_upload_document(p_talent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_talent_document_count(p_talent_id) < 20;
END;
$$ LANGUAGE plpgsql;
