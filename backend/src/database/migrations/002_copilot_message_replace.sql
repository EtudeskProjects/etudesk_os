-- Migration: Add deleted_at to copilot_messages for message replacement (edit & resend)
-- When a user edits and resends a message, all messages from the edited one onward
-- are soft-deleted (deleted_at set) and replaced by the new exchange.

ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for efficient filtering of non-deleted messages
CREATE INDEX IF NOT EXISTS idx_copilot_messages_deleted ON copilot_messages(session_id, deleted_at) WHERE deleted_at IS NULL;
