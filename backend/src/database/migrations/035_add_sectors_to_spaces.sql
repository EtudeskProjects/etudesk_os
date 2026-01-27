-- Migration 035: Add sectors to spaces
-- Date: 2026-01-27
-- Description: Adds sectors field to spaces table for activity domain classification

-- Add sectors column (array of strings, max 5)
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS sectors TEXT[] DEFAULT '{}';

-- Create GIN index for array search performance
CREATE INDEX IF NOT EXISTS idx_spaces_sectors ON spaces USING GIN(sectors);

-- Add comment explaining sectors
COMMENT ON COLUMN spaces.sectors IS 'Activity sectors for the space (max 5), e.g. DIGITAL, EDUCATION, HEALTH';
