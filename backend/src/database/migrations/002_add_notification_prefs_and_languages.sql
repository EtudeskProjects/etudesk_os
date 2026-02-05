-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 002_add_notification_prefs_and_languages
-- Created: 2026-02-03
-- Description:
--   1. Adds missing columns to notification_preferences (push_enabled, email_enabled, etc.)
--   2. Creates talent_languages table for language proficiency tracking
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. NOTIFICATION PREFERENCES - ADD MISSING COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Master switches for notification channels
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;

-- Category switches
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_opportunities BOOLEAN DEFAULT TRUE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN DEFAULT TRUE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_applications BOOLEAN DEFAULT TRUE;

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN DEFAULT TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TALENT LANGUAGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS talent_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    language VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE'
        CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_talent_languages_talent_id ON talent_languages(talent_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_talent_languages_updated_at ON talent_languages;
CREATE TRIGGER trigger_talent_languages_updated_at
    BEFORE UPDATE ON talent_languages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Check push_enabled column
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'notification_preferences' AND column_name = 'push_enabled'
    ) THEN
        RAISE NOTICE 'push_enabled column added to notification_preferences';
    ELSE
        RAISE EXCEPTION 'Failed to add push_enabled column';
    END IF;

    -- Check talent_languages table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'talent_languages') THEN
        RAISE NOTICE 'talent_languages table created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create talent_languages table';
    END IF;
END $$;
