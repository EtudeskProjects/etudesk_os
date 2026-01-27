-- Migration 034: Space invitations system
-- Date: 2026-01-27
-- Description: Adds table for managing space invitations
-- Note: No status column - invitations are DELETED when accepted/declined/cancelled

-- ============================================================================
-- SPACE INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS space_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Invitee (can be existing user OR email-only for non-registered users)
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255), -- Optional name for display

    -- Invitation details
    message TEXT, -- Custom message from admin

    -- Token for email verification (for non-registered users)
    invitation_token VARCHAR(255) UNIQUE,

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate invitations to same person for same space
    CONSTRAINT unique_space_invitation UNIQUE (space_id, invitee_email)
);

-- Indexes for space_invitations
CREATE INDEX IF NOT EXISTS idx_space_invitations_space_id
    ON space_invitations(space_id);
CREATE INDEX IF NOT EXISTS idx_space_invitations_invitee_talent_id
    ON space_invitations(invitee_talent_id) WHERE invitee_talent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_space_invitations_invitee_email
    ON space_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_space_invitations_invited_by
    ON space_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_space_invitations_token
    ON space_invitations(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_space_invitations_expires_at
    ON space_invitations(expires_at);

-- Comments
COMMENT ON TABLE space_invitations IS 'Stores pending invitations for spaces. Records are deleted when accepted/declined/cancelled.';
COMMENT ON COLUMN space_invitations.invitee_talent_id IS 'Reference to existing talent if email matches registered user';
COMMENT ON COLUMN space_invitations.invitation_token IS 'Unique token for email link verification (for non-registered users)';
