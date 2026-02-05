-- Add is_draft to community_activities (used by feed filter and draft/publish logic)
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- Backfill: treat status = 'DRAFT' as is_draft TRUE
UPDATE community_activities SET is_draft = TRUE WHERE status = 'DRAFT' AND (is_draft IS NULL OR is_draft = FALSE);
