-- Migration: Community Activities and Permissions
-- Description: Adds support for posts, events, polls, reactions, comments, and community roles.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ENHANCE COMMUNITY MEMBERS (Permissions)
-- ════════════════════════════════════════════════════════════════════════════

-- Add role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_members' AND column_name = 'role'
    ) THEN
        ALTER TABLE community_members 
        ADD COLUMN role VARCHAR(20) DEFAULT 'MEMBER';
    END IF;
END $$;

-- Add check constraint for roles
ALTER TABLE community_members 
DROP CONSTRAINT IF EXISTS community_members_role_check;

ALTER TABLE community_members 
ADD CONSTRAINT community_members_role_check 
CHECK (role IN ('ADMIN', 'MODERATOR', 'MEMBER'));

-- Add permissions column for granular overrides
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CREATE COMMUNITY ACTIVITIES TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('POST', 'EVENT', 'POLL')),
    content TEXT NOT NULL,
    
    -- Metadata (Event details, Poll config, etc.)
    -- For events: { start_date, end_date, location_type, location, meeting_url }
    -- For polls: { multiple_choice, end_date, options: [] }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Attachments (Images, Documents)
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Status and Moderation
    is_pinned BOOLEAN DEFAULT FALSE,
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    moderation_reason TEXT,
    
    -- Counters (denormalized for performance)
    reactions_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_community_activities_community_id ON community_activities(community_id);
CREATE INDEX IF NOT EXISTS idx_community_activities_author_id ON community_activities(author_id);
CREATE INDEX IF NOT EXISTS idx_community_activities_type ON community_activities(type);
CREATE INDEX IF NOT EXISTS idx_community_activities_created_at ON community_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_community_activities_moderation_status ON community_activities(moderation_status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_community_activities_updated_at ON community_activities;
CREATE TRIGGER trigger_community_activities_updated_at
    BEFORE UPDATE ON community_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CREATE ACTIVITY INTERACTIONS (Reactions, Comments, Bookmarks)
-- ════════════════════════════════════════════════════════════════════════════

-- REACTION
CREATE TABLE IF NOT EXISTS community_activity_reactions (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'LIKE', -- LIKE, LOVE, CELEBRATE, SUPPORT, INSIGHTFUL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (activity_id, user_id)
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS community_activity_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    parent_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE, -- For nested comments
    
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    
    reactions_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_community_comments_activity_id ON community_activity_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON community_activity_comments(parent_id);

-- COMMENT REACTIONS
CREATE TABLE IF NOT EXISTS community_comment_reactions (
    comment_id UUID NOT NULL REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'LIKE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (comment_id, user_id)
);

-- BOOKMARKS
CREATE TABLE IF NOT EXISTS community_activity_bookmarks (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (activity_id, user_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. POLL SYSTEM
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    text VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    votes_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_community_poll_options_activity_id ON community_poll_options(activity_id);

CREATE TABLE IF NOT EXISTS community_poll_votes (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (activity_id, user_id) -- One vote per poll per user (can clear and revote, but not multiple options for now, unless we change this PK)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. FUNCTION TO UPDATE COUNTS
-- ════════════════════════════════════════════════════════════════════════════

-- Update reaction counts
CREATE OR REPLACE FUNCTION update_activity_reactions_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE community_activities SET reactions_count = reactions_count + 1 WHERE id = NEW.activity_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE community_activities SET reactions_count = reactions_count - 1 WHERE id = OLD.activity_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_reactions_count
AFTER INSERT OR DELETE ON community_activity_reactions
FOR EACH ROW EXECUTE FUNCTION update_activity_reactions_count();

-- Update comment counts
CREATE OR REPLACE FUNCTION update_activity_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE community_activities SET comments_count = comments_count + 1 WHERE id = NEW.activity_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE community_activities SET comments_count = comments_count - 1 WHERE id = OLD.activity_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_comments_count
AFTER INSERT OR DELETE ON community_activity_comments
FOR EACH ROW EXECUTE FUNCTION update_activity_comments_count();

-- Update poll vote counts
CREATE OR REPLACE FUNCTION update_poll_option_votes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE community_poll_options SET votes_count = votes_count + 1 WHERE id = NEW.option_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE community_poll_options SET votes_count = votes_count - 1 WHERE id = OLD.option_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE community_poll_options SET votes_count = votes_count - 1 WHERE id = OLD.option_id;
        UPDATE community_poll_options SET votes_count = votes_count + 1 WHERE id = NEW.option_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_poll_option_votes_count
AFTER INSERT OR UPDATE OR DELETE ON community_poll_votes
FOR EACH ROW EXECUTE FUNCTION update_poll_option_votes_count();
