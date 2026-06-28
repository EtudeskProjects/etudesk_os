-- 029_remove_whatsapp_ultramsg.sql
-- Remove WhatsApp/UltraMsg support. Authentication is email OTP only.

DROP TABLE IF EXISTS whatsapp_support_reports;
DROP TABLE IF EXISTS whatsapp_support_messages;

UPDATE users
SET
  email = COALESCE(NULLIF(email, ''), 'legacy-' || id::text || '@etudesk.local'),
  email_verified = FALSE,
  email_verified_at = NULL,
  updated_at = NOW()
WHERE (email IS NULL OR email = '')
  AND deleted_at IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_required;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_required;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_email_required CHECK (NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL);

DROP INDEX IF EXISTS idx_users_email_unique_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_active
  ON users (email)
  WHERE deleted_at IS NULL;

DELETE FROM waitlist WHERE contact_type = 'WHATSAPP';
ALTER TABLE waitlist DROP CONSTRAINT IF EXISTS waitlist_contact_type_check;
ALTER TABLE waitlist ADD CONSTRAINT waitlist_contact_type_check CHECK (contact_type IN ('EMAIL'));
