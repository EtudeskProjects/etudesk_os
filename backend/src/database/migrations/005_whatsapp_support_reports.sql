-- Structured issue/feedback intake from WhatsApp support for enterprise follow-up
CREATE TABLE IF NOT EXISTS whatsapp_support_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_e164 VARCHAR(25) NOT NULL,
    linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    linked_talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('issue', 'feedback')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
    message_text TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reports_status_priority_created
  ON whatsapp_support_reports(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reports_phone_created
  ON whatsapp_support_reports(phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reports_user_created
  ON whatsapp_support_reports(linked_user_id, created_at DESC)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_reports_talent_created
  ON whatsapp_support_reports(linked_talent_id, created_at DESC)
  WHERE linked_talent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trigger_whatsapp_support_reports_updated_at ON whatsapp_support_reports;
CREATE TRIGGER trigger_whatsapp_support_reports_updated_at
    BEFORE UPDATE ON whatsapp_support_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
