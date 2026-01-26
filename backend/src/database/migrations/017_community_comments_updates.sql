-- Migration: Community Comments Updates
-- Date: 2026-01-25
-- Description: Adds mentions support and edit tracking for comments

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ADD MENTIONS SUPPORT
-- ════════════════════════════════════════════════════════════════════════════

-- Add mentions column to store array of mentioned user UUIDs
ALTER TABLE community_activity_comments
ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT NULL;

-- Create GIN index for efficient mention lookups
CREATE INDEX IF NOT EXISTS idx_community_comments_mentions
ON community_activity_comments USING GIN(mentions)
WHERE mentions IS NOT NULL;

COMMENT ON COLUMN community_activity_comments.mentions IS 'Array of talent UUIDs mentioned in this comment (@pseudo)';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ADD EDIT TRACKING
-- ════════════════════════════════════════════════════════════════════════════

-- Add edited_at to track manual edits (distinct from updated_at which includes any update)
ALTER TABLE community_activity_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN community_activity_comments.edited_at IS 'Timestamp of last manual edit by author (NULL = never edited)';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. REMOVE REACTIONS_COUNT (NO REACTIONS ON COMMENTS IN SPECS)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE community_activity_comments
DROP COLUMN IF EXISTS reactions_count;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ADD TRIGGER FOR UPDATED_AT ON COMMENTS
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_community_comments_updated_at ON community_activity_comments;

CREATE TRIGGER trigger_community_comments_updated_at
BEFORE UPDATE ON community_activity_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CREATE FUNCTION TO EXTRACT MENTIONS FROM CONTENT
-- ════════════════════════════════════════════════════════════════════════════

-- This function extracts @mentions from comment content
-- Note: Actual mention resolution (pseudo -> UUID) should be done in application layer
-- This is a helper for validation/extraction
CREATE OR REPLACE FUNCTION extract_mentions_from_content(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
    mentions TEXT[];
BEGIN
    -- Extract all @mentions (alphanumeric + underscore, 3-30 chars)
    SELECT ARRAY(
        SELECT DISTINCT SUBSTRING(match FROM 2) -- Remove the @ prefix
        FROM regexp_matches(content, '@([a-zA-Z0-9_]{3,30})', 'g') AS match
    ) INTO mentions;

    RETURN mentions;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_mentions_from_content IS 'Extracts @mention pseudos from text content';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. ADD REPLY COUNT TO PARENT COMMENTS (DENORMALIZED)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE community_activity_comments
ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;

-- Function to update reply count
CREATE OR REPLACE FUNCTION update_comment_replies_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE community_activity_comments
            SET replies_count = replies_count + 1
            WHERE id = NEW.parent_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE community_activity_comments
            SET replies_count = GREATEST(replies_count - 1, 0)
            WHERE id = OLD.parent_id;
        END IF;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle soft delete
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
            UPDATE community_activity_comments
            SET replies_count = GREATEST(replies_count - 1, 0)
            WHERE id = NEW.parent_id;
        -- Handle restore
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.parent_id IS NOT NULL THEN
            UPDATE community_activity_comments
            SET replies_count = replies_count + 1
            WHERE id = NEW.parent_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_replies_count ON community_activity_comments;

CREATE TRIGGER trigger_update_comment_replies_count
AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON community_activity_comments
FOR EACH ROW EXECUTE FUNCTION update_comment_replies_count();

-- Initialize replies_count for existing data
UPDATE community_activity_comments c
SET replies_count = (
    SELECT COUNT(*)
    FROM community_activity_comments replies
    WHERE replies.parent_id = c.id
      AND replies.deleted_at IS NULL
)
WHERE c.parent_id IS NULL;

COMMENT ON COLUMN community_activity_comments.replies_count IS 'Denormalized count of direct replies to this comment';

-- ════════════════════════════════════════════════════════════════════════════
-- 7. INDEX FOR THREADED COMMENTS
-- ════════════════════════════════════════════════════════════════════════════

-- Index for fetching top-level comments for an activity
CREATE INDEX IF NOT EXISTS idx_community_comments_top_level
ON community_activity_comments(activity_id, created_at)
WHERE parent_id IS NULL AND deleted_at IS NULL;

-- Index for fetching replies to a comment
CREATE INDEX IF NOT EXISTS idx_community_comments_replies
ON community_activity_comments(parent_id, created_at)
WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

-- Index for fetching comments by author
CREATE INDEX IF NOT EXISTS idx_community_comments_author
ON community_activity_comments(author_id, created_at DESC)
WHERE deleted_at IS NULL;
