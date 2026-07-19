-- WhatsApp login challenges are deliberately separate from email OTPs.
-- This keeps the existing email-auth flow stable and makes channel auditing explicit.
CREATE TABLE IF NOT EXISTS whatsapp_otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(30) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    provider_message_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_codes_phone ON whatsapp_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_codes_valid
    ON whatsapp_otp_codes(phone, expires_at) WHERE used_at IS NULL;
