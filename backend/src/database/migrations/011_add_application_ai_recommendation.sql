-- AI-generated recommendation for opportunity applications
ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;

ALTER TABLE opportunity_applications
ADD COLUMN IF NOT EXISTS ai_recommendation_at TIMESTAMP WITH TIME ZONE;
