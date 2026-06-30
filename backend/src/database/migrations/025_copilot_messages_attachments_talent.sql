-- 025_copilot_messages_attachments_talent.sql
-- The copilot chat persists the user message with `attachments` (voice-note /
-- file payload, JSONB) and `talent_id` (sender attribution; getSessionMessages
-- LEFT JOINs talents on it for sender_name / sender_avatar_url). Neither column
-- existed on copilot_messages, so the first user turn threw `column "attachments"
-- does not exist` right after session creation. Add both to match the code.

ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS talent_id UUID REFERENCES talents(id) ON DELETE SET NULL;
