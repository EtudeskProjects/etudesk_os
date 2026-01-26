-- Migration: Add community invitations system
-- Date: 2026-01-25
-- Description: Adds table for managing community invitations sent by admins to users

-- ============================================================================
-- COMMUNITY INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    -- Invitee (can be existing user OR email-only for non-registered users)
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255), -- Optional name for display
    
    -- Invitation details
    message TEXT, -- Custom message from admin
    role VARCHAR(50) DEFAULT 'MEMBER', -- ADMIN, MODERATOR, MEMBER
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
    
    -- Token for email verification (for non-registered users)
    invitation_token VARCHAR(255) UNIQUE,
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate pending invitations
    CONSTRAINT unique_pending_invitation UNIQUE (community_id, invitee_email, status)
);

-- Indexes for community_invitations
CREATE INDEX IF NOT EXISTS idx_community_invitations_community_id 
    ON community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee_talent_id 
    ON community_invitations(invitee_talent_id) WHERE invitee_talent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee_email 
    ON community_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_community_invitations_invited_by 
    ON community_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_community_invitations_status 
    ON community_invitations(status);
CREATE INDEX IF NOT EXISTS idx_community_invitations_token 
    ON community_invitations(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_invitations_expires_at 
    ON community_invitations(expires_at) WHERE status = 'PENDING';

-- Trigger for updated_at
CREATE TRIGGER trigger_community_invitations_updated_at
    BEFORE UPDATE ON community_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE community_invitations IS 'Stores invitations sent by community admins to invite users';
COMMENT ON COLUMN community_invitations.invitee_talent_id IS 'Reference to existing talent if email matches registered user';
COMMENT ON COLUMN community_invitations.invitation_token IS 'Unique token for email link verification (for non-registered users)';
COMMENT ON COLUMN community_invitations.role IS 'Role the invitee will have when they accept (ADMIN, MODERATOR, MEMBER)';
