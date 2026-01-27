-- Migration: Add missing fields for opportunities and applications
-- Version: 001
-- Date: 2026-01-19

-- ============================================================================
-- OPPORTUNITIES TABLE: Add new fields
-- ============================================================================

-- Add cv_required field
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS cv_required BOOLEAN DEFAULT FALSE;

-- Add application_questions field for application questions
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS application_questions JSONB;

-- Add experience_level field
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50) CHECK (
  experience_level IS NULL OR experience_level IN ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE')
);

-- Add cover_image_url field (if not exists)
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- ============================================================================
-- OPPORTUNITY_APPLICATIONS TABLE: Add new fields
-- ============================================================================

-- Add resume_url field
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Add internal_notes for recruiters
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add rating (1-5 stars)
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Add viewed_at timestamp
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;

-- Add updated_at timestamp
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add interview_scheduled_at
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMP WITH TIME ZONE;

-- Add interview_location
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS interview_location TEXT;

-- Add interview_notes
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS interview_notes TEXT;

-- ============================================================================
-- UPDATE APPLICATION STATUS CHECK CONSTRAINT
-- ============================================================================

-- Drop existing constraint if exists
ALTER TABLE opportunity_applications
DROP CONSTRAINT IF EXISTS opportunity_applications_status_check;

-- Update any non-conforming status values to 'PENDING' before adding constraint
UPDATE opportunity_applications
SET status = 'PENDING'
WHERE status IS NULL OR status NOT IN ('PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- Add updated constraint with more statuses
ALTER TABLE opportunity_applications
ADD CONSTRAINT opportunity_applications_status_check CHECK (
  status IN ('PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
);

-- ============================================================================
-- ADD TRIGGER FOR updated_at
-- ============================================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_opportunity_applications_updated_at ON opportunity_applications;

-- Create trigger
CREATE TRIGGER trigger_opportunity_applications_updated_at
    BEFORE UPDATE ON opportunity_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_application_updated_at();

-- ============================================================================
-- ADD INDEXES
-- ============================================================================

-- Index for interview scheduling
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_interview_scheduled_at
ON opportunity_applications(interview_scheduled_at)
WHERE interview_scheduled_at IS NOT NULL;

-- Index for rating
CREATE INDEX IF NOT EXISTS idx_opportunity_applications_rating
ON opportunity_applications(rating)
WHERE rating IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN opportunities.cv_required IS 'Whether CV/resume upload is required for applications';
COMMENT ON COLUMN opportunities.application_questions IS 'JSON array of custom application questions';
COMMENT ON COLUMN opportunities.experience_level IS 'Required experience level: ENTRY, JUNIOR, MID, SENIOR, LEAD, EXECUTIVE';
COMMENT ON COLUMN opportunity_applications.resume_url IS 'URL to the uploaded CV/resume file';
COMMENT ON COLUMN opportunity_applications.internal_notes IS 'Private notes from recruiters (not visible to applicants)';
COMMENT ON COLUMN opportunity_applications.rating IS 'Recruiter rating 1-5 stars';
COMMENT ON COLUMN opportunity_applications.viewed_at IS 'When the recruiter first viewed this application';
COMMENT ON COLUMN opportunity_applications.interview_scheduled_at IS 'Scheduled interview date and time';
COMMENT ON COLUMN opportunity_applications.interview_location IS 'Interview location (address or video call link)';
COMMENT ON COLUMN opportunity_applications.interview_notes IS 'Notes about the interview';
