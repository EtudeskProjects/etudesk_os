-- Migration: Community Activities Updates
-- Date: 2026-01-25
-- Description: Adds scheduled publishing, bookmarks counter, and pinning constraints

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ADD SCHEDULED PUBLISHING COLUMNS
-- ════════════════════════════════════════════════════════════════════════════

-- Add scheduled_at for deferred publishing
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add published_at for actual publication time
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for finding scheduled posts to publish
CREATE INDEX IF NOT EXISTS idx_community_activities_scheduled
ON community_activities(scheduled_at)
WHERE scheduled_at IS NOT NULL AND published_at IS NULL AND deleted_at IS NULL;

-- Index for published content ordering
CREATE INDEX IF NOT EXISTS idx_community_activities_published
ON community_activities(community_id, published_at DESC)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN community_activities.scheduled_at IS 'Scheduled publication date/time (NULL = immediate)';
COMMENT ON COLUMN community_activities.published_at IS 'Actual publication date/time (NULL = not yet published or scheduled)';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ADD BOOKMARKS COUNT WITH TRIGGER
-- ════════════════════════════════════════════════════════════════════════════

-- Add bookmarks_count column
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS bookmarks_count INTEGER DEFAULT 0;

-- Create or replace function to update bookmarks count
CREATE OR REPLACE FUNCTION update_activity_bookmarks_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE community_activities
        SET bookmarks_count = bookmarks_count + 1
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE community_activities
        SET bookmarks_count = GREATEST(bookmarks_count - 1, 0)
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_activity_bookmarks_count ON community_activity_bookmarks;

CREATE TRIGGER trigger_update_activity_bookmarks_count
AFTER INSERT OR DELETE ON community_activity_bookmarks
FOR EACH ROW EXECUTE FUNCTION update_activity_bookmarks_count();

-- Initialize bookmarks_count for existing data
UPDATE community_activities ca
SET bookmarks_count = (
    SELECT COUNT(*)
    FROM community_activity_bookmarks cab
    WHERE cab.activity_id = ca.id
)
WHERE EXISTS (
    SELECT 1 FROM community_activity_bookmarks cab WHERE cab.activity_id = ca.id
);

COMMENT ON COLUMN community_activities.bookmarks_count IS 'Denormalized count of bookmarks (favorites)';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. UNIQUE PINNED ACTIVITY PER COMMUNITY (MAX 1)
-- ════════════════════════════════════════════════════════════════════════════

-- Drop existing index if it exists with different definition
DROP INDEX IF EXISTS idx_community_activities_one_pinned_per_community;

-- Create unique partial index: only one pinned activity per community
CREATE UNIQUE INDEX idx_community_activities_one_pinned_per_community
ON community_activities(community_id)
WHERE is_pinned = TRUE AND deleted_at IS NULL;

COMMENT ON INDEX idx_community_activities_one_pinned_per_community IS 'Ensures only one pinned activity per community';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DROP SHARES_COUNT (NOT IN SPECS)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE community_activities
DROP COLUMN IF EXISTS shares_count;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. SIMPLIFY REACTIONS TO LIKES ONLY
-- ════════════════════════════════════════════════════════════════════════════

-- Remove the type column from reactions (only likes now)
ALTER TABLE community_activity_reactions
DROP COLUMN IF EXISTS type;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. ADD CONTENT VALIDATION CONSTRAINTS
-- ════════════════════════════════════════════════════════════════════════════

-- Add constraint for maximum attachments (5 files max)
-- Note: This is validated in application layer since it's JSONB
-- We add a comment for documentation
COMMENT ON COLUMN community_activities.attachments IS 'Array of attachment URLs. Max 5 files, each max 20MB. Validated in application.';

-- Ensure content is not empty
ALTER TABLE community_activities
DROP CONSTRAINT IF EXISTS community_activities_content_not_empty;

ALTER TABLE community_activities
ADD CONSTRAINT community_activities_content_not_empty
CHECK (content IS NOT NULL AND LENGTH(TRIM(content)) > 0);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. UPDATE FUNCTION TO AUTO-SET PUBLISHED_AT
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_activity_published_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If not scheduled, set published_at to now
    IF NEW.scheduled_at IS NULL AND NEW.published_at IS NULL THEN
        NEW.published_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_activity_published_at ON community_activities;

CREATE TRIGGER trigger_set_activity_published_at
BEFORE INSERT ON community_activities
FOR EACH ROW EXECUTE FUNCTION set_activity_published_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. CREATE VIEW FOR PUBLISHED ACTIVITIES (FEED)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW community_feed AS
SELECT
    ca.*,
    COALESCE(ca.published_at, ca.created_at) AS display_date
FROM community_activities ca
WHERE ca.deleted_at IS NULL
  AND ca.moderation_status = 'APPROVED'
  AND (
      ca.scheduled_at IS NULL  -- Immediate posts
      OR ca.published_at IS NOT NULL  -- Scheduled posts that have been published
      OR ca.scheduled_at <= NOW()  -- Scheduled posts whose time has come
  )
ORDER BY ca.is_pinned DESC, display_date DESC;

COMMENT ON VIEW community_feed IS 'Published activities ready to display in feed (excludes scheduled future posts)';
