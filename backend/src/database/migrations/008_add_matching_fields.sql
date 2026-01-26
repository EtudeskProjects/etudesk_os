-- Migration: Add matching and AI recommendation fields
-- Date: 2024-01-20

-- Add AI recommendation fields to applications
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
ADD COLUMN IF NOT EXISTS ai_recommendation_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_ai_recommendation_at
ON opportunity_applications(ai_recommendation_at)
WHERE ai_recommendation IS NOT NULL;

-- Ensure embedding columns exist (for semantic matching)
-- These may already exist from schema.sql but adding IF NOT EXISTS for safety
DO $$
BEGIN
  -- Check and add embedding to talent_profiles if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_profiles' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE talent_profiles ADD COLUMN embedding JSONB;
  END IF;

  -- Check and add embedding to opportunities if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN embedding JSONB;
  END IF;
END $$;

-- Create comment explaining the matching system
COMMENT ON COLUMN opportunity_applications.ai_recommendation IS
'AI-generated 30-word recommendation for this application, cached for 24h';

COMMENT ON COLUMN opportunity_applications.ai_recommendation_at IS
'Timestamp when AI recommendation was generated, used for cache invalidation';
