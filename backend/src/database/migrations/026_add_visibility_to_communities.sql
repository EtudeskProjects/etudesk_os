-- Migration: Add visibility column to communities
-- Date: 2026-01-26
-- Description: Adds visibility column to replace access_type

-- Add visibility column
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'UNLISTED'));

-- Add index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON communities(visibility);

-- Comment
COMMENT ON COLUMN communities.visibility IS 'Visibility: PUBLIC (visible in explore), PRIVATE (invite only), UNLISTED (link only)';
