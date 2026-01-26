-- Migration: Drop deprecated opportunity fields
-- Version: 003
-- Date: 2026-01-25
-- Description: Remove work_type, compensation_type, and experience_level columns
--              These have been replaced by contract_type, work_rhythm, and removed respectively

-- Drop deprecated columns if they exist
ALTER TABLE opportunities DROP COLUMN IF EXISTS work_type;
ALTER TABLE opportunities DROP COLUMN IF EXISTS compensation_type;
ALTER TABLE opportunities DROP COLUMN IF EXISTS experience_level;

-- Note: If you need to preserve data from these columns, run migrate_opportunity_types.sql first
-- to migrate the data to the new columns before running this migration.
