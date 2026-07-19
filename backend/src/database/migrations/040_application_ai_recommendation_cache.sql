-- Recommendation service persists its generated insight for 24h. These columns
-- are referenced by the service and must exist on every production schema.
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommendation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_opportunity_applications_ai_recommendation
  ON opportunity_applications (ai_recommendation_at DESC)
  WHERE ai_recommendation IS NOT NULL;
