-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 040: Cleanup Deprecated Tables
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This migration removes deprecated features:
-- - Projects (replaced by portfolio links in talents)
-- - Documents (replaced by KYC verification service)
-- - Hubs (replaced by Spaces in migration 030)
-- - Legacy community tables
--
-- Date: 2026-01-27
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DROP PROJECT-RELATED TABLES
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS project_skills CASCADE;
DROP TABLE IF EXISTS project_links CASCADE;
DROP TABLE IF EXISTS talent_projects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS active_projects CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. DROP DOCUMENT-RELATED TABLES
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS document_skills CASCADE;
DROP TABLE IF EXISTS talent_documents CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS active_documents CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. DROP LEGACY HUB TABLES (if not already dropped)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS hub_bookings CASCADE;
DROP TABLE IF EXISTS hub_skills CASCADE;
DROP TABLE IF EXISTS organization_hubs CASCADE;
DROP TABLE IF EXISTS hubs CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DROP LEGACY KYC TABLE
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS kyc_verifications CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. CLEANUP LEGACY COMMUNITY TABLES (if exists)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop community_skills if it still exists (was deprecated in migration 018)
DROP TABLE IF EXISTS community_skills CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. REMOVE ORPHANED REFERENCES
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove verified_by references from talent_experiences if it references documents
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'talent_experiences'
        AND column_name = 'verified_by'
        AND data_type = 'uuid'
    ) THEN
        -- Check if it's a foreign key to documents
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'talent_experiences'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'documents'
        ) THEN
            ALTER TABLE talent_experiences DROP CONSTRAINT IF EXISTS talent_experiences_verified_by_fkey;
        END IF;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════

-- Log the cleanup
DO $$
BEGIN
    RAISE NOTICE 'Migration 040: Deprecated tables cleaned up successfully';
    RAISE NOTICE '  - Removed: projects, project_links, talent_projects, project_skills';
    RAISE NOTICE '  - Removed: documents, talent_documents, document_skills';
    RAISE NOTICE '  - Removed: hubs, hub_bookings, hub_skills, organization_hubs (if existed)';
    RAISE NOTICE '  - Removed: kyc_verifications, community_skills (if existed)';
END $$;
