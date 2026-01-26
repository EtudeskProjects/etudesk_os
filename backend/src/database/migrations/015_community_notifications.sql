-- Migration: Community Notifications System
-- Date: 2026-01-25
-- Description: Adds notifications table for community-specific notifications (mentions, replies, events, subscriptions)

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CREATE COMMUNITY NOTIFICATIONS TABLE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Notification type
    type VARCHAR(50) NOT NULL,

    -- References (nullable based on notification type)
    activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES talents(id) ON DELETE SET NULL, -- User who triggered the notification

    -- Content
    title VARCHAR(255) NOT NULL,
    body TEXT DEFAULT NULL,

    -- Additional data for notification handling
    data JSONB DEFAULT '{}',

    -- Read status
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- For scheduled notifications (event reminders)
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add type check constraint
ALTER TABLE community_notifications
DROP CONSTRAINT IF EXISTS community_notifications_type_check;

ALTER TABLE community_notifications
ADD CONSTRAINT community_notifications_type_check
CHECK (type IN (
    'MENTION',              -- @mention in a comment or post
    'COMMENT_REPLY',        -- Reply to user's comment
    'NEW_ACTIVITY',         -- New post/event/poll in community
    'EVENT_REMINDER_1D',    -- Event reminder: 1 day before
    'EVENT_REMINDER_1H',    -- Event reminder: 1 hour before
    'SUBSCRIPTION_EXPIRING', -- Subscription expiring soon (3 days before)
    'SUBSCRIPTION_EXPIRED', -- Subscription has expired
    'PAYMENT_FAILED',       -- Payment failed
    'PAYMENT_SUCCESS',      -- Payment successful
    'MEMBERSHIP_APPROVED',  -- Membership request approved
    'MEMBERSHIP_REJECTED'   -- Membership request rejected
));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_notifications_talent
ON community_notifications(talent_id);

CREATE INDEX IF NOT EXISTS idx_community_notifications_community
ON community_notifications(community_id);

CREATE INDEX IF NOT EXISTS idx_community_notifications_type
ON community_notifications(type);

CREATE INDEX IF NOT EXISTS idx_community_notifications_activity
ON community_notifications(activity_id)
WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_notifications_comment
ON community_notifications(comment_id)
WHERE comment_id IS NOT NULL;

-- Unread notifications for a user (frequently queried)
CREATE INDEX IF NOT EXISTS idx_community_notifications_unread
ON community_notifications(talent_id, created_at DESC)
WHERE read_at IS NULL;

-- Scheduled notifications not yet sent
CREATE INDEX IF NOT EXISTS idx_community_notifications_scheduled
ON community_notifications(scheduled_for)
WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;

-- Recent notifications by community for a user
CREATE INDEX IF NOT EXISTS idx_community_notifications_user_community
ON community_notifications(talent_id, community_id, created_at DESC);

COMMENT ON TABLE community_notifications IS 'Notifications for community activities: mentions, replies, events, payments';
COMMENT ON COLUMN community_notifications.type IS 'Type of notification: MENTION, COMMENT_REPLY, NEW_ACTIVITY, EVENT_REMINDER_*, SUBSCRIPTION_*, PAYMENT_*, MEMBERSHIP_*';
COMMENT ON COLUMN community_notifications.actor_id IS 'User who triggered the notification (e.g., who mentioned you)';
COMMENT ON COLUMN community_notifications.data IS 'Additional JSON data specific to notification type';
COMMENT ON COLUMN community_notifications.scheduled_for IS 'For event reminders: when to send the notification';
COMMENT ON COLUMN community_notifications.sent_at IS 'When the notification was actually sent (for push/email)';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CREATE NOTIFICATION PREFERENCES FOR COMMUNITIES
-- ════════════════════════════════════════════════════════════════════════════

-- Add community notification preferences if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
        -- Add columns for granular community notification settings
        ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS notify_community_mentions BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_community_replies BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_community_activities BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_community_events BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_community_payments BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CREATE FUNCTION TO BATCH MARK NOTIFICATIONS AS READ
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION mark_community_notifications_read(
    p_talent_id UUID,
    p_community_id UUID DEFAULT NULL,
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NOT NULL AND array_length(p_notification_ids, 1) > 0 THEN
        -- Mark specific notifications as read
        UPDATE community_notifications
        SET read_at = NOW()
        WHERE talent_id = p_talent_id
          AND id = ANY(p_notification_ids)
          AND read_at IS NULL;
    ELSIF p_community_id IS NOT NULL THEN
        -- Mark all notifications for a specific community as read
        UPDATE community_notifications
        SET read_at = NOW()
        WHERE talent_id = p_talent_id
          AND community_id = p_community_id
          AND read_at IS NULL;
    ELSE
        -- Mark all notifications as read
        UPDATE community_notifications
        SET read_at = NOW()
        WHERE talent_id = p_talent_id
          AND read_at IS NULL;
    END IF;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_community_notifications_read IS 'Batch mark notifications as read by IDs, community, or all';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CREATE VIEW FOR UNREAD NOTIFICATION COUNT
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW community_notification_counts AS
SELECT
    talent_id,
    community_id,
    COUNT(*) FILTER (WHERE read_at IS NULL) AS unread_count,
    COUNT(*) AS total_count,
    MAX(created_at) FILTER (WHERE read_at IS NULL) AS latest_unread_at
FROM community_notifications
GROUP BY talent_id, community_id;

COMMENT ON VIEW community_notification_counts IS 'Aggregated notification counts per user per community';
