-- 031_external_opportunities.sql
-- Distinguish Etudesk-managed applications from external opportunities.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS application_mode VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN IF NOT EXISTS external_apply_email TEXT,
  ADD COLUMN IF NOT EXISTS external_apply_url TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT;

ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opportunities_application_mode_check;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_application_mode_check
  CHECK (application_mode IN ('IN_APP', 'EMAIL'));

CREATE INDEX IF NOT EXISTS idx_opportunities_application_mode
  ON opportunities(application_mode)
  WHERE deleted_at IS NULL;
