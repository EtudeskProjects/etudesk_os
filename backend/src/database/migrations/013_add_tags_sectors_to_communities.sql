-- Migration: Add tags and sectors columns to communities table
-- Date: 2026-01-21
-- Description: Adds tags (max 3) and sectors columns for community classification

-- Add tags column (stored as JSONB for flexibility)
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT NULL;

-- Add sectors column (stored as JSONB array)
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS sectors JSONB DEFAULT NULL;

-- Create GIN indexes for faster queries on JSONB columns
CREATE INDEX IF NOT EXISTS idx_communities_tags 
ON communities USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_communities_sectors 
ON communities USING GIN(sectors);

COMMENT ON COLUMN communities.tags IS 'Array of community tags (max 3) stored as JSONB';
COMMENT ON COLUMN communities.sectors IS 'Array of sector IDs stored as JSONB';
