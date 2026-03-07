-- Users may authenticate with email OR WhatsApp phone.
-- Stop relying on placeholder emails like wa_XXXXXXXX@etudesk.local.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

-- Backfill legacy placeholder-email WhatsApp users into the real phone column.
UPDATE users
SET
  phone = COALESCE(
    NULLIF(phone, ''),
    '+' || regexp_replace(split_part(email, '@', 1), '[^0-9]', '', 'g')
  ),
  email = NULL,
  email_verified = FALSE,
  email_verified_at = NULL,
  updated_at = NOW()
WHERE email LIKE 'wa_%@etudesk.local'
  AND deleted_at IS NULL;

-- Replace absolute email uniqueness with active-row partial uniqueness.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS idx_users_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_active
  ON users (email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique_active
  ON users (phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_required;

ALTER TABLE users
  ADD CONSTRAINT users_email_or_phone_required
  CHECK (
    NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(phone, '')), '') IS NOT NULL
  );
