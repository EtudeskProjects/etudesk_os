-- Migration 051: Add gender to talents, drop coordinates, drop talent_experiences & talent_educations

-- 1. Add gender column to talents
ALTER TABLE talents ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- 2. Drop coordinates from talents
ALTER TABLE talents DROP COLUMN IF EXISTS coordinates;

-- 3. Drop talent_experiences table and its indexes
DROP TABLE IF EXISTS talent_experiences CASCADE;

-- 4. Drop talent_educations table and its indexes
DROP TABLE IF EXISTS talent_educations CASCADE;
