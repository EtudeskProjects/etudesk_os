-- 021: Add visibility toggle for talent skills
-- Allows talents to hide specific skills from public views
ALTER TABLE talent_skills ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE;
