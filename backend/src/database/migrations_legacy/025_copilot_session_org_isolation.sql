-- Migration 025: Copilot session organization isolation
-- Adds organization_id to copilot_sessions for proper org/talent session separation
-- Adds attachments column to copilot_messages (code already references it)

-- 1. Add organization_id to copilot_sessions (nullable — NULL = personal talent session)
ALTER TABLE copilot_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Index for fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_org
  ON copilot_sessions(organization_id)
  WHERE organization_id IS NOT NULL AND deleted_at IS NULL;

-- 3. Composite index for listSessions with org filter
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_talent_org
  ON copilot_sessions(talent_id, organization_id)
  WHERE deleted_at IS NULL;

-- 4. Add attachments JSONB to copilot_messages (code already INSERTs/UPDATEs it)
ALTER TABLE copilot_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB;

-- 5. Relax mode constraint to allow 'study' mode (schema had CHECK only 'explore')
ALTER TABLE copilot_sessions DROP CONSTRAINT IF EXISTS copilot_sessions_mode_check;
ALTER TABLE copilot_sessions ADD CONSTRAINT copilot_sessions_mode_check
  CHECK (mode IN ('explore', 'study'));
