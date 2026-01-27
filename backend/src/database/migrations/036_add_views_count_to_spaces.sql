-- Migration: Add views_count to spaces table
-- This enables tracking how many times a space has been viewed

-- Add views_count column with default 0
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Create index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_spaces_views_count ON spaces(views_count DESC);
