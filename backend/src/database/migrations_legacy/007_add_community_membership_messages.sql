-- Community membership messages: conversation between talent and organization (admins)
-- Used for PENDING memberships (questions) and ACTIVE (support)

CREATE TABLE IF NOT EXISTS community_membership_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_id UUID NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('TALENT', 'ORGANIZATION')),
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    proposed_datetime TIMESTAMP WITH TIME ZONE,
    datetime_type VARCHAR(50),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_membership_messages_membership_id ON community_membership_messages(membership_id);
CREATE INDEX idx_community_membership_messages_created_at ON community_membership_messages(created_at);

CREATE TRIGGER trigger_community_membership_messages_updated_at
    BEFORE UPDATE ON community_membership_messages FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
