-- Migration: Add membership fields to community_members table
-- Date: 2026-01-21
-- Description: Adds support for membership application answers and rules acceptance

-- Add answers column to store membership application answers (JSON)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT NULL;

-- Add accepted_rules column to track if user accepted community rules
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS accepted_rules BOOLEAN DEFAULT FALSE;

-- Add status column if not exists (ACTIVE, PENDING, REJECTED)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Add updated_at column if not exists
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add views_count to communities table if not exists
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Add images column to communities (array of image URLs)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT NULL;

-- Add is_paid and monthly_price columns for paid communities
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10, 2) DEFAULT NULL;

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'XOF';

-- Create index on community_members for faster lookups
CREATE INDEX IF NOT EXISTS idx_community_members_community_talent 
ON community_members(community_id, talent_id);

CREATE INDEX IF NOT EXISTS idx_community_members_status 
ON community_members(status);

-- Add comment for documentation
COMMENT ON COLUMN community_members.answers IS 'JSON array of {question, answer} objects from membership application';
COMMENT ON COLUMN community_members.accepted_rules IS 'Whether the user accepted community rules during join';
COMMENT ON COLUMN community_members.status IS 'Membership status: ACTIVE, PENDING, REJECTED';
