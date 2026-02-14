-- Migration 013: Add preferred_language column to users table
-- Stores the user's preferred language for backend responses and emails

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'fr';

-- Create index for language-based queries (e.g. batch email sending)
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);
