-- Keep phone as optional profile/contact data. Authentication remains email-only.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Preserve any legacy placeholder users by assigning a non-deliverable local email.
UPDATE users
SET
  phone = COALESCE(
    NULLIF(phone, ''),
    '+' || regexp_replace(split_part(email, '@', 1), '[^0-9]', '', 'g')
  ),
  email = COALESCE(NULLIF(email, ''), 'legacy-' || id::text || '@etudesk.local'),
  email_verified = FALSE,
  email_verified_at = NULL,
  updated_at = NOW()
WHERE (email IS NULL OR email = '' OR email LIKE 'wa_%@etudesk.local')
  AND deleted_at IS NULL;

-- Replace absolute email uniqueness with active-row partial uniqueness.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS idx_users_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_active
  ON users (email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique_active
  ON users (phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_required;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_required;

ALTER TABLE users
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_email_required
  CHECK (NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL);
