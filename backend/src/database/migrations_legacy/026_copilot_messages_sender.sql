-- Migration 026: Add sender tracking to copilot messages
-- Enables shared org sessions where multiple members can see who wrote what

-- 1. Add talent_id to copilot_messages (who sent this message)
ALTER TABLE copilot_messages
  ADD COLUMN IF NOT EXISTS talent_id UUID REFERENCES talents(id) ON DELETE SET NULL;

-- 2. Index for quick sender lookups
CREATE INDEX IF NOT EXISTS idx_copilot_messages_talent
  ON copilot_messages(talent_id)
  WHERE talent_id IS NOT NULL;

-- 3. Backfill: set talent_id from session's talent_id for existing user messages
UPDATE copilot_messages cm
  SET talent_id = cs.talent_id
  FROM copilot_sessions cs
  WHERE cm.session_id = cs.id
    AND cm.role = 'user'
    AND cm.talent_id IS NULL;
