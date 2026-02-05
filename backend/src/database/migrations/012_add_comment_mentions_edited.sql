-- mentions (array of talent UUIDs) and edited_at for community_activity_comments
ALTER TABLE community_activity_comments
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT NULL;

ALTER TABLE community_activity_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
