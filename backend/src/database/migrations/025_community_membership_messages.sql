-- Migration: Re-create community membership messages table
-- Date: 2026-01-26
-- Description: Adds messaging support between admins and community members

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
    proposed_datetime TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    datetime_type VARCHAR(30) DEFAULT NULL CHECK (datetime_type IN ('MEETING_PROPOSAL', 'EVENT_INVITATION', 'AVAILABILITY')),
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_membership_id
    ON community_membership_messages(membership_id);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_created_at
    ON community_membership_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_sender
    ON community_membership_messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_community_membership_messages_unread
    ON community_membership_messages(membership_id, read_at) WHERE read_at IS NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_community_membership_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_community_membership_messages_updated_at ON community_membership_messages;
CREATE TRIGGER trigger_community_membership_messages_updated_at
    BEFORE UPDATE ON community_membership_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_community_membership_messages_updated_at();

-- Add unread_messages counter to community_members for badge display
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS unread_messages INTEGER DEFAULT 0;

-- Comments
COMMENT ON TABLE community_membership_messages IS 'Messages exchanged between talents and organizations regarding community memberships';
COMMENT ON COLUMN community_membership_messages.sender_type IS 'TALENT or ORGANIZATION';
COMMENT ON COLUMN community_membership_messages.proposed_datetime IS 'Optional datetime for meeting/event proposals';
COMMENT ON COLUMN community_membership_messages.datetime_type IS 'Type of datetime: MEETING_PROPOSAL, EVENT_INVITATION, AVAILABILITY';
