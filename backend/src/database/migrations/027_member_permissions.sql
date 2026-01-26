-- Migration: Add member permissions system
-- Date: 2026-01-26
-- Description: Adds permissions for community members (create posts, events, polls)

-- Add default permissions to communities table (for new members)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS default_member_permissions JSONB DEFAULT '{"can_post": true, "can_create_event": false, "can_create_poll": false}'::jsonb;

-- Add individual permissions to community_members table (overrides defaults)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- Comment
COMMENT ON COLUMN communities.default_member_permissions IS 'Default permissions for new members: can_post, can_create_event, can_create_poll';
COMMENT ON COLUMN community_members.permissions IS 'Individual member permissions (overrides community defaults). NULL = use community defaults';

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_members_permissions ON community_members USING GIN (permissions) WHERE permissions IS NOT NULL;
