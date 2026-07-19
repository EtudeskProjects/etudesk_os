-- 038 — Unified notification preference channels
-- The API and mobile settings use these product-level switches. Keep the
-- legacy per-event switches for backwards compatibility with existing data.

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notify_opportunities BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_applications BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE notification_preferences
SET
    email_enabled = COALESCE(email_new_message, email_new_application, email_application_status, TRUE),
    push_enabled = COALESCE(push_new_message, push_new_application, push_application_status, TRUE),
    notify_messages = COALESCE(email_new_message, push_new_message, TRUE),
    notify_applications = COALESCE(email_new_application, push_new_application, email_application_status, push_application_status, TRUE),
    notify_reminders = COALESCE(email_interview_reminder, push_interview_reminder, TRUE);
