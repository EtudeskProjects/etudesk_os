-- Migration 032: Add visibility to opportunities
-- Date: 2026-01-27
-- Description: Allows opportunities to be PUBLIC, PRIVATE, or UNLISTED

-- Add visibility column
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC';

-- Create index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_visibility ON opportunities(visibility);

-- Add comment explaining visibility values
COMMENT ON COLUMN opportunities.visibility IS 'PUBLIC = visible in explore, PRIVATE = only via invitation, UNLISTED = accessible by link';
