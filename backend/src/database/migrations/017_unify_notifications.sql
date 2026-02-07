-- Migration 017: Unify notifications and community_notifications tables
-- Adds community-related columns to notifications table and migrates data

-- 1. Add missing columns to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS activity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES talents(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;

-- sent_at may already exist from push-notification.service storeNotification
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

-- 2. Drop old type constraint and add extended one
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  -- Legacy types
  'APPLICATION_STATUS_CHANGED', 'NEW_MESSAGE', 'NEW_APPLICATION',
  'INTERVIEW_SCHEDULED', 'INTERVIEW_REMINDER', 'INVITATION_RECEIVED', 'SYSTEM',
  -- Push notification types (from push-notification.service)
  'OPPORTUNITY', 'APPLICATION', 'MESSAGE', 'SPACE', 'REMINDER', 'MEMBERSHIP', 'BOOKING',
  -- Community notification types
  'MENTION', 'COMMENT_REPLY', 'NEW_ACTIVITY',
  'EVENT_REMINDER_1D', 'EVENT_REMINDER_1H',
  'EVENT_REMINDER', 'BOOKING_REMINDER', 'OPPORTUNITY_REMINDER', 'APPLICATION_REMINDER',
  'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED'
));

-- 3. Migrate community_notifications into notifications
INSERT INTO notifications (
  talent_id, type, title, body, data,
  community_id, activity_id, comment_id, actor_id,
  scheduled_for, sent_at, created_at,
  read_at
)
SELECT
  cn.talent_id, cn.type, cn.title, cn.body, cn.data,
  cn.community_id, cn.activity_id, cn.comment_id, cn.actor_id,
  cn.scheduled_for, cn.sent_at, cn.created_at,
  cn.read_at
FROM community_notifications cn
ON CONFLICT DO NOTHING;

-- 4. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_notifications_community
  ON notifications(community_id) WHERE community_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
  ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor
  ON notifications(actor_id) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);
