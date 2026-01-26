-- Migration: Add drafts support for community activities
-- This adds an is_draft column to allow users to save posts as drafts
-- Business rule: Only ONE draft per type per member per community

-- Add is_draft column to community_activities
ALTER TABLE community_activities ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- Create COMPOSITE index for efficient draft queries and enforcing one draft per type rule
-- This index supports: getDrafts(author, community), getDrafts(author, community, type)
CREATE INDEX IF NOT EXISTS idx_community_activities_drafts_composite
ON community_activities(author_id, community_id, type, is_draft)
WHERE is_draft = TRUE;

-- Drop the old simple index if it exists (it's redundant with composite index)
DROP INDEX IF EXISTS idx_community_activities_drafts;

-- Add comment to column
COMMENT ON COLUMN community_activities.is_draft IS 'True if this activity is saved as a draft and not yet published. Business rule: Only ONE draft per type per member per community.';
