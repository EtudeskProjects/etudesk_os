-- 018: Add waitlist table for landing page signups
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('TALENT', 'ORGANIZATION')),
    country VARCHAR(100) NOT NULL,
    contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('EMAIL', 'WHATSAPP')),
    contact_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_contact ON waitlist(contact_value);
