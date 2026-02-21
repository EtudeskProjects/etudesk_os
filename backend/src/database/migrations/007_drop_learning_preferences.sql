-- Migration 007: Drop learning_preferences column from talents
-- The LLM infers pedagogical style from context — no need for explicit preferences.

ALTER TABLE talents DROP COLUMN IF EXISTS learning_preferences;
