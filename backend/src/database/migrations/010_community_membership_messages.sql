-- Migration: Add community membership messages and enhance membership tracking
-- Similar to application_messages for opportunity applications

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CREATE COMMUNITY MEMBERSHIP MESSAGES TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_membership_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('TALENT', 'ORGANIZATION')),
    sender_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    proposed_datetime TIMESTAMP DEFAULT NULL,
    datetime_type VARCHAR(30) DEFAULT NULL CHECK (datetime_type IN ('MEETING_PROPOSAL', 'EVENT_INVITATION', 'AVAILABILITY')),
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_membership_id 
    ON community_membership_messages(membership_id);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_created_at 
    ON community_membership_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_sender 
    ON community_membership_messages(sender_type, sender_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ENHANCE COMMUNITY MEMBERS TABLE
-- ════════════════════════════════════════════════════════════════════════════

-- Add internal notes (visible only to organization)
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL;

-- Add rating (1-5 stars, like applications)
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Add viewed_at (when organization first viewed the request)
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP DEFAULT NULL;

-- Add rejected_at (when membership was rejected)
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP DEFAULT NULL;

-- Add rejection_reason (optional reason for rejection)
ALTER TABLE community_members 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Ensure status column exists with proper values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_members' AND column_name = 'status'
    ) THEN
        ALTER TABLE community_members 
        ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
    END IF;
END $$;

-- Update status check constraint to include all possible values
ALTER TABLE community_members 
DROP CONSTRAINT IF EXISTS community_members_status_check;

ALTER TABLE community_members 
ADD CONSTRAINT community_members_status_check 
CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED'));

-- Index for efficient status filtering
CREATE INDEX IF NOT EXISTS idx_community_members_status 
    ON community_members(status);
CREATE INDEX IF NOT EXISTS idx_community_members_community_status 
    ON community_members(community_id, status);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ADD NOTIFICATION SUPPORT FOR COMMUNITIES
-- ════════════════════════════════════════════════════════════════════════════

-- Ensure notification_preferences has community-related columns
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS notify_communities BOOLEAN DEFAULT TRUE;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ADD UUID COLUMN TO COMMUNITY_MEMBERS IF NOT EXISTS
-- ════════════════════════════════════════════════════════════════════════════

-- Check if id column exists and add if not (some tables use composite keys)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_members' AND column_name = 'id'
    ) THEN
        ALTER TABLE community_members 
        ADD COLUMN id UUID DEFAULT gen_random_uuid();
        
        -- Make it primary key if not exists
        ALTER TABLE community_members
        DROP CONSTRAINT IF EXISTS community_members_pkey;
        
        ALTER TABLE community_members
        ADD PRIMARY KEY (id);
        
        -- Keep unique constraint on community_id + talent_id
        ALTER TABLE community_members
        ADD CONSTRAINT community_members_unique_membership UNIQUE (community_id, talent_id);
    END IF;
END $$;

COMMENT ON TABLE community_membership_messages IS 'Messages exchanged between talents and organizations regarding community memberships';
COMMENT ON COLUMN community_members.internal_notes IS 'Internal notes visible only to organization members';
COMMENT ON COLUMN community_members.rating IS 'Rating of the member (1-5 stars)';
COMMENT ON COLUMN community_members.viewed_at IS 'When organization first viewed the membership request';
COMMENT ON COLUMN community_members.rejected_at IS 'When membership was rejected';
COMMENT ON COLUMN community_members.rejection_reason IS 'Optional reason for rejection';
