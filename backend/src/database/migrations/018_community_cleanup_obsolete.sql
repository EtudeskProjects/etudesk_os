-- Migration: Community Cleanup - Remove Obsolete Tables and Columns
-- Date: 2026-01-25
-- Description: Removes tables and columns not in the new community specs
-- IMPORTANT: Run this migration AFTER data migration/backup if needed

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DROP OBSOLETE TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- Drop community_comment_reactions (no reactions on comments in specs, only likes on activities)
DROP TABLE IF EXISTS community_comment_reactions CASCADE;

-- Drop community_membership_messages (not in new specs)
DROP TABLE IF EXISTS community_membership_messages CASCADE;

-- Drop community_skills (not in new specs)
DROP TABLE IF EXISTS community_skills CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CLEANUP COMMUNITY_MEMBERS TABLE
-- Note: Keeping permissions and membership_type as per user request
-- ════════════════════════════════════════════════════════════════════════════

-- Remove columns that were for recruitment workflow, not community management
ALTER TABLE community_members
DROP COLUMN IF EXISTS internal_notes,
DROP COLUMN IF EXISTS rating,
DROP COLUMN IF EXISTS viewed_at;

-- Note: Keeping the following columns as requested:
-- - permissions JSONB
-- - membership_type VARCHAR(50)
-- - rejected_at, rejection_reason (useful for membership workflow)

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DROP OBSOLETE INDEXES
-- ════════════════════════════════════════════════════════════════════════════

-- Drop indexes for removed tables
DROP INDEX IF EXISTS idx_community_skills_skill_id;
DROP INDEX IF EXISTS idx_community_membership_messages_membership_id;
DROP INDEX IF EXISTS idx_community_membership_messages_created_at;
DROP INDEX IF EXISTS idx_community_membership_messages_sender;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DROP OBSOLETE TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_community_membership_messages_updated_at ON community_membership_messages;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. DROP OBSOLETE FUNCTIONS (if not used elsewhere)
-- ════════════════════════════════════════════════════════════════════════════

-- Note: Be careful with shared functions. Only drop if specific to removed features.
-- Most update_* functions are shared and should be kept.

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RENAME LIKES TABLE FOR CLARITY (OPTIONAL)
-- ════════════════════════════════════════════════════════════════════════════

-- The table community_activity_reactions now only contains likes
-- Consider renaming for clarity (optional - requires updating all references)
-- Uncomment if you want to rename:
-- ALTER TABLE community_activity_reactions RENAME TO community_activity_likes;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. ADD DOCUMENTATION COMMENTS
-- ════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE community_activity_reactions IS 'Likes on community activities (simplified from reactions)';
COMMENT ON TABLE community_members IS 'Community membership with roles (ADMIN, MODERATOR, MEMBER) and permissions';
COMMENT ON COLUMN community_members.permissions IS 'Granular permission overrides as JSONB array';
COMMENT ON COLUMN community_members.membership_type IS 'Type of membership: MEMBER, ALUMNI, STAFF';

-- ════════════════════════════════════════════════════════════════════════════
-- 8. VACUUM ANALYZE AFTER CLEANUP
-- ════════════════════════════════════════════════════════════════════════════

-- Run VACUUM to reclaim storage and update statistics
-- Note: This should be run during a maintenance window
-- VACUUM ANALYZE community_members;
-- VACUUM ANALYZE community_activities;
-- VACUUM ANALYZE community_activity_comments;
