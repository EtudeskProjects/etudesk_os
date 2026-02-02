-- Migration: Merge skills table into talent_skills + cleanup
-- This migration:
-- 1. Adds canonical_name and type columns to talent_skills
-- 2. Migrates data from skills table
-- 3. Drops unused tables and columns

BEGIN;

-- Step 1: Add new columns to talent_skills
ALTER TABLE talent_skills ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255);
ALTER TABLE talent_skills ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Step 2: Populate from skills table
UPDATE talent_skills ts
SET canonical_name = s.canonical_name,
    type = s.type
FROM skills s
WHERE ts.skill_id = s.id;

-- Step 3: Set defaults for any orphaned rows
UPDATE talent_skills
SET canonical_name = 'Unknown', type = 'KNOWLEDGE'
WHERE canonical_name IS NULL;

-- Step 4: Make columns NOT NULL
ALTER TABLE talent_skills ALTER COLUMN canonical_name SET NOT NULL;
ALTER TABLE talent_skills ALTER COLUMN type SET NOT NULL;

-- Step 5: Drop old columns and constraints
ALTER TABLE talent_skills DROP CONSTRAINT IF EXISTS talent_skills_talent_id_skill_id_key;
ALTER TABLE talent_skills DROP COLUMN IF EXISTS skill_id;
ALTER TABLE talent_skills DROP COLUMN IF EXISTS endorsed_count;

-- Step 6: Add new unique constraint
ALTER TABLE talent_skills ADD CONSTRAINT talent_skills_talent_id_canonical_name_key UNIQUE (talent_id, canonical_name);

-- Step 7: Drop columns from talents
ALTER TABLE talents DROP COLUMN IF EXISTS education_level;
ALTER TABLE talents DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE talents DROP COLUMN IF EXISTS portfolio_url;

-- Step 8: Drop columns from mentorships and recommendations
ALTER TABLE mentorships DROP COLUMN IF EXISTS focus_area_skill_ids;
ALTER TABLE recommendations DROP COLUMN IF EXISTS highlighted_skill_ids;

-- Step 9: Drop junction tables
DROP TABLE IF EXISTS opportunity_skills CASCADE;
DROP TABLE IF EXISTS project_skills CASCADE;
DROP TABLE IF EXISTS organization_skills CASCADE;
DROP TABLE IF EXISTS community_skills CASCADE;
DROP TABLE IF EXISTS talent_learning_goals CASCADE;

-- Step 10: Drop skills table
DROP TABLE IF EXISTS skills CASCADE;

-- Step 11: Drop active_skills view
DROP VIEW IF EXISTS active_skills;

-- Step 12: Create index on canonical_name
CREATE INDEX IF NOT EXISTS idx_talent_skills_canonical_name ON talent_skills(canonical_name);

COMMIT;
