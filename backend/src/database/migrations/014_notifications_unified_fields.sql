-- Align `notifications` table with unified notification service.
-- Fixes missing columns like `community_id` observed in runtime.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES talents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Keep checks consistent with all notification types used by services.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'APPLICATION_STATUS_CHANGED', 'NEW_MESSAGE', 'NEW_APPLICATION',
    'INTERVIEW_SCHEDULED', 'INTERVIEW_REMINDER', 'INVITATION_RECEIVED', 'SYSTEM',
    'OPPORTUNITY', 'APPLICATION', 'MESSAGE', 'SPACE', 'REMINDER', 'MEMBERSHIP', 'BOOKING',
    'MENTION', 'COMMENT_REPLY', 'NEW_ACTIVITY',
    'EVENT_REMINDER_1D', 'EVENT_REMINDER_1H', 'EVENT_REMINDER',
    'BOOKING_REMINDER', 'OPPORTUNITY_REMINDER', 'APPLICATION_REMINDER',
    'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED'
  ));

CREATE INDEX IF NOT EXISTS idx_notifications_community_id ON notifications(community_id);
CREATE INDEX IF NOT EXISTS idx_notifications_activity_id ON notifications(activity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at_unread ON notifications(talent_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_schedule_pending ON notifications(scheduled_for, sent_at);
