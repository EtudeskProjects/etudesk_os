-- Migration: Update opportunity types and fields
-- Date: 2026-01-21
-- Description: Migrate old opportunity type values to new values
--              and handle work_type → contract_type + work_rhythm split

-- ═══════════════════════════════════════════════════════════════
-- 1. MIGRATE OPPORTUNITY TYPES
-- ═══════════════════════════════════════════════════════════════

-- Map old types to new types
UPDATE opportunities SET type = 'FREELANCE' WHERE type = 'CONSULTANCY';
UPDATE opportunities SET type = 'FREELANCE' WHERE type = 'GIG';
UPDATE opportunities SET type = 'ALTERNATION' WHERE type = 'APPRENTICESHIP';
UPDATE opportunities SET type = 'EMPLOYMENT' WHERE type = 'FELLOWSHIP';

-- ═══════════════════════════════════════════════════════════════
-- 2. ADD NEW COLUMNS IF NOT EXIST
-- ═══════════════════════════════════════════════════════════════

-- Add contract_type column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'contract_type'
    ) THEN
        ALTER TABLE opportunities ADD COLUMN contract_type VARCHAR(50);
    END IF;
END $$;

-- Add work_rhythm column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'work_rhythm'
    ) THEN
        ALTER TABLE opportunities ADD COLUMN work_rhythm VARCHAR(50);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. MIGRATE WORK_TYPE TO CONTRACT_TYPE + WORK_RHYTHM
-- ═══════════════════════════════════════════════════════════════

-- If work_type column exists, migrate its values
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'work_type'
    ) THEN
        -- Map work_type to contract_type
        UPDATE opportunities SET contract_type = 'CDI' WHERE work_type = 'FULL_TIME' AND contract_type IS NULL;
        UPDATE opportunities SET contract_type = 'CDD' WHERE work_type = 'PART_TIME' AND contract_type IS NULL;
        UPDATE opportunities SET contract_type = 'CDD' WHERE work_type = 'CONTRACT' AND contract_type IS NULL;
        UPDATE opportunities SET contract_type = 'FREELANCE' WHERE work_type = 'FREELANCE' AND contract_type IS NULL;
        UPDATE opportunities SET contract_type = 'INTERNSHIP' WHERE work_type = 'INTERNSHIP' AND contract_type IS NULL;
        UPDATE opportunities SET contract_type = 'APPRENTICESHIP' WHERE work_type = 'APPRENTICESHIP' AND contract_type IS NULL;

        -- Set work_rhythm based on old work_type
        UPDATE opportunities SET work_rhythm = 'FULL_TIME' WHERE work_type = 'FULL_TIME' AND work_rhythm IS NULL;
        UPDATE opportunities SET work_rhythm = 'PART_TIME' WHERE work_type = 'PART_TIME' AND work_rhythm IS NULL;
        UPDATE opportunities SET work_rhythm = 'FULL_TIME' WHERE work_type IN ('CONTRACT', 'FREELANCE') AND work_rhythm IS NULL;
        UPDATE opportunities SET work_rhythm = 'FULL_TIME' WHERE work_type IN ('INTERNSHIP', 'APPRENTICESHIP') AND work_rhythm IS NULL;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 4. SET DEFAULT WORK_RHYTHM FOR REMAINING RECORDS
-- ═══════════════════════════════════════════════════════════════

-- Set default work_rhythm for opportunities that don't have one
UPDATE opportunities SET work_rhythm = 'FULL_TIME' WHERE work_rhythm IS NULL;

-- Set default contract_type based on opportunity type for remaining records
UPDATE opportunities SET contract_type = 'INTERNSHIP' WHERE type = 'INTERNSHIP' AND contract_type IS NULL;
UPDATE opportunities SET contract_type = 'APPRENTICESHIP' WHERE type = 'ALTERNATION' AND contract_type IS NULL;
UPDATE opportunities SET contract_type = 'FREELANCE' WHERE type = 'FREELANCE' AND contract_type IS NULL;
UPDATE opportunities SET contract_type = 'CDI' WHERE type = 'EMPLOYMENT' AND contract_type IS NULL;
UPDATE opportunities SET contract_type = 'CDD' WHERE contract_type IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 5. DROP OLD COLUMNS (OPTIONAL - RUN SEPARATELY IF NEEDED)
-- ═══════════════════════════════════════════════════════════════

-- Uncomment these lines after verifying the migration was successful:
-- ALTER TABLE opportunities DROP COLUMN IF EXISTS work_type;
-- ALTER TABLE opportunities DROP COLUMN IF EXISTS experience_level;
-- ALTER TABLE opportunities DROP COLUMN IF EXISTS compensation_type;

-- ═══════════════════════════════════════════════════════════════
-- 6. REMOVE ALL CHECK CONSTRAINTS (no enums in database)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_type_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_contract_type_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_work_rhythm_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_location_type_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_compensation_frequency_check;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run these to check the migration)
-- ═══════════════════════════════════════════════════════════════

-- Check type distribution:
-- SELECT type, COUNT(*) FROM opportunities GROUP BY type ORDER BY type;

-- Check contract_type distribution:
-- SELECT contract_type, COUNT(*) FROM opportunities GROUP BY contract_type ORDER BY contract_type;

-- Check work_rhythm distribution:
-- SELECT work_rhythm, COUNT(*) FROM opportunities GROUP BY work_rhythm ORDER BY work_rhythm;

-- Find any remaining old values:
-- SELECT id, type FROM opportunities WHERE type NOT IN ('EMPLOYMENT', 'INTERNSHIP', 'ENTREPRENEURSHIP', 'ALTERNATION', 'FREELANCE', 'VOLUNTEER');
