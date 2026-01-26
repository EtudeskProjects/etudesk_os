-- Migration: Application System Enhancements
-- Version: 006
-- Date: 2026-01-20
--
-- This migration:
-- 1. Enhances opportunity_applications with missing columns
-- 2. Creates application_messages table for candidate-organization communication
-- 3. Updates status constraint to include all statuses
-- 4. Adds indexes for performance

-- ============================================================================
-- ENHANCE OPPORTUNITY_APPLICATIONS TABLE
-- ============================================================================

-- 1. Add missing columns to opportunity_applications
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS star_rating INTEGER CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS interview_type VARCHAR(50) CHECK (interview_type IS NULL OR interview_type IN ('PHONE', 'VIDEO', 'IN_PERSON'));
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS interview_location TEXT;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS interview_notes TEXT;
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Update status constraint to include all statuses used in code
ALTER TABLE opportunity_applications DROP CONSTRAINT IF EXISTS opportunity_applications_status_check;
ALTER TABLE opportunity_applications ADD CONSTRAINT opportunity_applications_status_check
    CHECK (status IN ('PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'));

-- 3. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_viewed_at ON opportunity_applications(viewed_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_star_rating ON opportunity_applications(star_rating) WHERE star_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_interview_scheduled ON opportunity_applications(interview_scheduled_at) WHERE interview_scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_updated_at ON opportunity_applications(updated_at);

-- 4. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_opportunity_applications_updated_at ON opportunity_applications;
CREATE TRIGGER trigger_opportunity_applications_updated_at
    BEFORE UPDATE ON opportunity_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_application_updated_at();

-- ============================================================================
-- CREATE APPLICATION_MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,

    -- Sender information
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('TALENT', 'ORGANIZATION')),
    sender_id UUID NOT NULL, -- Can be talent_id or organization member talent_id

    -- Message content
    content TEXT NOT NULL,

    -- Rich content support
    attachments JSONB DEFAULT '[]'::jsonb, -- [{name, url, type, size}]

    -- Datetime sharing for interview scheduling
    proposed_datetime TIMESTAMP WITH TIME ZONE, -- For proposing meeting times
    datetime_type VARCHAR(50), -- 'INTERVIEW_PROPOSAL', 'MEETING_REQUEST', etc.

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for application_messages
CREATE INDEX IF NOT EXISTS idx_application_messages_application_id ON application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_sender_type ON application_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_application_messages_sender_id ON application_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_is_read ON application_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_application_messages_created_at ON application_messages(created_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_application_messages_updated_at ON application_messages;
CREATE TRIGGER trigger_application_messages_updated_at
    BEFORE UPDATE ON application_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE application_messages IS 'Messages between candidates and organizations for job applications';
COMMENT ON COLUMN application_messages.sender_type IS 'TALENT for candidate messages, ORGANIZATION for recruiter messages';
COMMENT ON COLUMN application_messages.attachments IS 'JSON array of file attachments: [{name, url, type, size}]';
COMMENT ON COLUMN application_messages.proposed_datetime IS 'Proposed datetime for interviews or meetings';
COMMENT ON COLUMN application_messages.datetime_type IS 'Type of datetime proposal: INTERVIEW_PROPOSAL, MEETING_REQUEST, etc.';

COMMENT ON COLUMN opportunity_applications.cv_url IS 'URL to the candidate CV/resume file';
COMMENT ON COLUMN opportunity_applications.attachments IS 'Additional application attachments as JSON array';
COMMENT ON COLUMN opportunity_applications.internal_notes IS 'Private notes from recruiters (not visible to candidate)';
COMMENT ON COLUMN opportunity_applications.star_rating IS 'Recruiter rating 1-5 stars';
COMMENT ON COLUMN opportunity_applications.viewed_at IS 'When the application was first viewed by organization';
COMMENT ON COLUMN opportunity_applications.interview_type IS 'Type of interview: PHONE, VIDEO, or IN_PERSON';
