-- Persist WhatsApp support interactions (inbound/outbound) with account-link context
CREATE TABLE IF NOT EXISTS whatsapp_support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_e164 VARCHAR(25) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('received', 'generated', 'sent', 'failed')),
    message_text TEXT NOT NULL,
    channel_message_id VARCHAR(255),
    linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    linked_talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    link_action VARCHAR(30) NOT NULL DEFAULT 'none' CHECK (link_action IN ('none', 'user_by_talent', 'linked_user_to_talent')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_support_phone_created
  ON whatsapp_support_messages(phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_support_user_created
  ON whatsapp_support_messages(linked_user_id, created_at DESC)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_support_talent_created
  ON whatsapp_support_messages(linked_talent_id, created_at DESC)
  WHERE linked_talent_id IS NOT NULL;
