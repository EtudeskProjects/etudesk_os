-- Migration: Add access_type column to communities table if not exists
-- Date: 2026-01-21
-- Description: Adds access_type column for backward compatibility and filtering

-- Add access_type column if it doesn't exist
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS access_type VARCHAR(50) DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_communities_access_type 
ON communities(access_type);

-- Update existing communities: if no access_type is set, default to PUBLIC
UPDATE communities 
SET access_type = 'PUBLIC' 
WHERE access_type IS NULL;

COMMENT ON COLUMN communities.access_type IS 'Access type: PUBLIC (visible in explore) or PRIVATE/MEMBERSHIP (requires approval)';
