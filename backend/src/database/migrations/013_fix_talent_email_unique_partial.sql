-- Fix #12: talents.email UNIQUE constraint blocks re-creation after soft-delete
-- Change from absolute UNIQUE to partial UNIQUE (only non-deleted rows)

-- Drop the existing absolute unique constraint
ALTER TABLE talents DROP CONSTRAINT IF EXISTS talents_email_key;

-- Create partial unique index: email must be unique ONLY among non-deleted talents
CREATE UNIQUE INDEX IF NOT EXISTS idx_talents_email_unique_active
  ON talents (email)
  WHERE deleted_at IS NULL;
