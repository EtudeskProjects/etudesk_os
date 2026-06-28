-- 024_copilot_sessions_organization.sql
-- copilot/session.service.ts (createSession, listSessions, getSession) reads and
-- writes copilot_sessions.organization_id (NULL = personal session, set = org-mode
-- session). Migration 003 only added the 'org' mode CHECK value but never the
-- column, so every copilot chat threw `column "organization_id" of relation
-- "copilot_sessions" does not exist` at session creation. Add the column to match.

ALTER TABLE copilot_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_org
  ON copilot_sessions (organization_id)
  WHERE organization_id IS NOT NULL;
