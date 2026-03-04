-- Add is_pinned column to copilot_sessions
ALTER TABLE copilot_sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient pinned-first ordering
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_pinned ON copilot_sessions(talent_id, is_pinned DESC, last_message_at DESC NULLS LAST) WHERE deleted_at IS NULL;
