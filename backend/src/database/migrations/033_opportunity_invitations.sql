-- Migration 033: Opportunity invitations system
-- Date: 2026-01-27
-- Description: Adds table for managing opportunity invitations
-- Note: No status column - invitations are DELETED when accepted/declined/cancelled

-- ============================================================================
-- OPPORTUNITY INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS opportunity_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
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

    -- Prevent duplicate invitations to same person for same opportunity
    CONSTRAINT unique_opportunity_invitation UNIQUE (opportunity_id, invitee_email)
);

-- Indexes for opportunity_invitations
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_opportunity_id
    ON opportunity_invitations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_invitee_talent_id
    ON opportunity_invitations(invitee_talent_id) WHERE invitee_talent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_invitee_email
    ON opportunity_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_invited_by
    ON opportunity_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_token
    ON opportunity_invitations(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_invitations_expires_at
    ON opportunity_invitations(expires_at);

-- Comments
COMMENT ON TABLE opportunity_invitations IS 'Stores pending invitations for opportunities. Records are deleted when accepted/declined/cancelled.';
COMMENT ON COLUMN opportunity_invitations.invitee_talent_id IS 'Reference to existing talent if email matches registered user';
COMMENT ON COLUMN opportunity_invitations.invitation_token IS 'Unique token for email link verification (for non-registered users)';
