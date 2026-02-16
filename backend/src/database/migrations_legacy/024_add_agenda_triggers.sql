-- 024_add_agenda_triggers.sql
-- Adds a persistent table for agent-scheduled agenda items (follow-ups, reminders, research tasks, etc.)

CREATE TABLE IF NOT EXISTS agenda_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope + owner
  scope TEXT NOT NULL CHECK (scope IN ('TALENT', 'ORGANIZATION')),
  talent_id UUID NULL REFERENCES talents(id) ON DELETE CASCADE,
  organization_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Trigger payload
  code TEXT NOT NULL, -- e.g. FOLLOW_UP, REMINDER, RESEARCH, ACTION
  title TEXT NOT NULL,
  description TEXT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'CANCELED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_by UUID NULL REFERENCES talents(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE NULL,

  CHECK (
    (scope = 'TALENT' AND talent_id IS NOT NULL AND organization_id IS NULL)
    OR
    (scope = 'ORGANIZATION' AND organization_id IS NOT NULL)
  )
);

-- Efficient reads for agenda ranges
CREATE INDEX IF NOT EXISTS idx_agenda_triggers_talent_due_at
  ON agenda_triggers (talent_id, due_at)
  WHERE scope = 'TALENT';

CREATE INDEX IF NOT EXISTS idx_agenda_triggers_org_due_at
  ON agenda_triggers (organization_id, due_at)
  WHERE scope = 'ORGANIZATION';

CREATE INDEX IF NOT EXISTS idx_agenda_triggers_status_due_at
  ON agenda_triggers (status, due_at);

-- updated_at trigger (shared function update_updated_at() already exists in baseline schema)
DROP TRIGGER IF EXISTS trigger_agenda_triggers_updated_at ON agenda_triggers;
CREATE TRIGGER trigger_agenda_triggers_updated_at
  BEFORE UPDATE ON agenda_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

