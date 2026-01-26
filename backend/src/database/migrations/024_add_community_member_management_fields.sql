-- Migration: Add community member management fields back
-- Date: 2026-01-26
-- Description: Re-adds internal_notes, rating, viewed_at columns to community_members
--              These were removed in migration 018 but are needed for member management workflow

-- Add internal_notes for organization notes
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL;

-- Add rating (1-5 stars, like applications)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Add viewed_at (when organization first viewed the membership request)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_members_rating
ON community_members(rating)
WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_members_viewed_at
ON community_members(viewed_at)
WHERE viewed_at IS NOT NULL;

-- Add documentation
COMMENT ON COLUMN community_members.internal_notes IS 'Internal notes visible only to organization members';
COMMENT ON COLUMN community_members.rating IS 'Rating of the member (1-5 stars)';
COMMENT ON COLUMN community_members.viewed_at IS 'When organization first viewed the membership request';
