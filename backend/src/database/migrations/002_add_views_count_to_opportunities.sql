-- Migration: Add views_count column to opportunities table
-- Version: 002
-- Date: 2026-01-25

-- Add views_count column if it doesn't exist
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Add index for views_count (useful for sorting by popularity)
CREATE INDEX IF NOT EXISTS idx_opportunities_views_count ON opportunities(views_count DESC)
WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN opportunities.views_count IS 'Number of times this opportunity has been viewed';
