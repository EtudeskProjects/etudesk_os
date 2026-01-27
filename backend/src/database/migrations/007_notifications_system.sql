-- Migration: Notifications System
-- Version: 007
-- Date: 2026-01-20
--
-- This migration creates:
-- 1. notification_preferences table for user settings
-- 2. notifications table for storing notifications
-- 3. push_tokens table for device tokens

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Email notifications
    email_application_status BOOLEAN DEFAULT TRUE,
    email_new_message BOOLEAN DEFAULT TRUE,
    email_new_application BOOLEAN DEFAULT TRUE, -- For organization owners
    email_interview_reminder BOOLEAN DEFAULT TRUE,
    email_marketing BOOLEAN DEFAULT FALSE,

    -- Push notifications
    push_application_status BOOLEAN DEFAULT TRUE,
    push_new_message BOOLEAN DEFAULT TRUE,
    push_new_application BOOLEAN DEFAULT TRUE,
    push_interview_reminder BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_talent_id ON notification_preferences(talent_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Notification type
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'APPLICATION_STATUS_CHANGED',
        'NEW_MESSAGE',
        'NEW_APPLICATION',
        'INTERVIEW_SCHEDULED',
        'INTERVIEW_REMINDER',
        'INVITATION_RECEIVED',
        'SYSTEM'
    )),

    -- Content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,

    -- Reference to related entity
    reference_type VARCHAR(50), -- 'application', 'message', 'invitation', etc.
    reference_id UUID,

    -- Additional data as JSON
    data JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Delivery status
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent BOOLEAN DEFAULT FALSE,
    push_sent_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist (in case table existed before)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_talent_id ON notifications(talent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);

-- ============================================================================
-- PUSH TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Expo push token
    token VARCHAR(255) NOT NULL,

    -- Device info
    device_type VARCHAR(20) CHECK (device_type IN ('ios', 'android', 'web')),
    device_name VARCHAR(255),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_talent_id ON push_tokens(talent_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notification_preferences IS 'User notification preferences for email and push notifications';
COMMENT ON TABLE notifications IS 'Notification history for all users';
COMMENT ON TABLE push_tokens IS 'Expo push notification tokens for mobile devices';

COMMENT ON COLUMN notifications.type IS 'Type of notification: APPLICATION_STATUS_CHANGED, NEW_MESSAGE, NEW_APPLICATION, INTERVIEW_SCHEDULED, INTERVIEW_REMINDER, INVITATION_RECEIVED, SYSTEM';
COMMENT ON COLUMN notifications.reference_type IS 'Type of referenced entity: application, message, invitation, etc.';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data specific to notification type';
