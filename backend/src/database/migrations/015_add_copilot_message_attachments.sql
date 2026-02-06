-- Migration: Add attachments column to copilot_messages
-- This column stores JSON data for file attachments in copilot chat messages

ALTER TABLE copilot_messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Add index for queries that filter by attachments presence
CREATE INDEX IF NOT EXISTS idx_copilot_messages_has_attachments
ON copilot_messages ((attachments IS NOT NULL));
