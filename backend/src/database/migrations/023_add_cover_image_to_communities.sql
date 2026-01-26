-- Migration: Add cover_image_url to communities table
-- Date: 2026-01-26
-- Description: Adds cover_image_url column to communities for hero images

-- Add cover_image_url column to communities (hero image like opportunities)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN communities.cover_image_url IS 'Hero/cover image URL for the community';
