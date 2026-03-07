-- Migration 007: Drop learning_preferences column from talents
-- The LLM infers pedagogical style from context — no need for explicit preferences.

DROP VIEW IF EXISTS active_talents;

ALTER TABLE talents DROP COLUMN IF EXISTS learning_preferences;

CREATE VIEW active_talents AS
SELECT *
FROM talents
WHERE deleted_at IS NULL;
