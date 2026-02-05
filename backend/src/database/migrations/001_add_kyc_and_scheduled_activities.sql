-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 001_add_kyc_and_scheduled_activities
-- Created: 2026-02-03
-- Description:
--   1. Creates kyc_verifications table for KYC document verification
--   2. Adds scheduled_at column to community_activities for scheduled posts
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. KYC VERIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('ID_CARD', 'PASSPORT', 'DRIVER_LICENSE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    rejection_reason TEXT,
    front_image_url TEXT NOT NULL,
    back_image_url TEXT,
    verification_score INTEGER DEFAULT 0,
    verification_details JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for kyc_verifications
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_id ON kyc_verifications(talent_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_talent_status ON kyc_verifications(talent_id, status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_kyc_verifications_updated_at ON kyc_verifications;
CREATE TRIGGER trigger_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. COMMUNITY ACTIVITIES - ADD SCHEDULED_AT COLUMN
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add scheduled_at column for scheduling future publication
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for efficiently querying scheduled activities
CREATE INDEX IF NOT EXISTS idx_community_activities_scheduled
ON community_activities(scheduled_at)
WHERE scheduled_at IS NOT NULL AND published_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verify tables and columns exist
DO $$
BEGIN
    -- Check kyc_verifications table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kyc_verifications') THEN
        RAISE NOTICE 'kyc_verifications table created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create kyc_verifications table';
    END IF;

    -- Check scheduled_at column
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'community_activities' AND column_name = 'scheduled_at'
    ) THEN
        RAISE NOTICE 'scheduled_at column added to community_activities';
    ELSE
        RAISE EXCEPTION 'Failed to add scheduled_at column';
    END IF;
END $$;
