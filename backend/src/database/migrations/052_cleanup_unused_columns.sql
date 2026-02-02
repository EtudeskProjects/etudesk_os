-- ═══════════════════════════════════════════════════════════════
-- Migration: 052_cleanup_unused_columns
-- Description: Drop unused columns removed during schema cleanup
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Drop dependent views ────────────────────────────────
DROP VIEW IF EXISTS active_talents;
DROP VIEW IF EXISTS active_skills;
DROP VIEW IF EXISTS v_talent_documents;

-- ─── 2. talents: drop display_name ──────────────────────────
ALTER TABLE talents DROP COLUMN IF EXISTS display_name;

-- ─── 3. skills: drop slug, aliases, domain, parent_skill_id,
--        esco_uri, onet_code, typical_evidence, growth_trend, embedding
DROP INDEX IF EXISTS idx_skills_slug;
DROP INDEX IF EXISTS idx_skills_domain;
DROP INDEX IF EXISTS idx_skills_parent;
ALTER TABLE skills DROP COLUMN IF EXISTS slug;
ALTER TABLE skills DROP COLUMN IF EXISTS aliases;
ALTER TABLE skills DROP COLUMN IF EXISTS domain;
ALTER TABLE skills DROP COLUMN IF EXISTS parent_skill_id;
ALTER TABLE skills DROP COLUMN IF EXISTS esco_uri;
ALTER TABLE skills DROP COLUMN IF EXISTS onet_code;
ALTER TABLE skills DROP COLUMN IF EXISTS typical_evidence;
ALTER TABLE skills DROP COLUMN IF EXISTS growth_trend;
ALTER TABLE skills DROP COLUMN IF EXISTS embedding;

-- Add UNIQUE constraint on canonical_name (replaces old slug unique)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_canonical_name_key'
  ) THEN
    ALTER TABLE skills ADD CONSTRAINT skills_canonical_name_key UNIQUE (canonical_name);
  END IF;
END $$;

-- ─── 4. talent_skills: drop self_assessed, years_of_experience, last_used_at
ALTER TABLE talent_skills DROP COLUMN IF EXISTS self_assessed;
ALTER TABLE talent_skills DROP COLUMN IF EXISTS years_of_experience;
ALTER TABLE talent_skills DROP COLUMN IF EXISTS last_used_at;

-- ─── 5. talent_documents: drop extracted_data ───────────────
DROP INDEX IF EXISTS idx_talent_documents_extracted;
ALTER TABLE talent_documents DROP COLUMN IF EXISTS extracted_data;

-- ─── 6. Dead tables ─────────────────────────────────────────
DROP TABLE IF EXISTS skill_evolutions;
DROP TABLE IF EXISTS skill_relations;
DROP TABLE IF EXISTS document_skills;
DROP VIEW  IF EXISTS active_documents;
DROP TABLE IF EXISTS documents CASCADE;

-- ─── 7. Add STUDENT_CARD to document_type enum ──────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'STUDENT_CARD'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
  ) THEN
    ALTER TYPE document_type ADD VALUE 'STUDENT_CARD';
  END IF;
END $$;

-- ─── 8. Recreate views (cleaned) ────────────────────────────

CREATE OR REPLACE VIEW active_talents AS
SELECT id, slug, first_name, last_name, bio, avatar_url,
       email, phone, city, region, country,
       remote_ready, willing_to_relocate,
       profile_tags, goals, sectors,
       created_at, updated_at
FROM talents
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW v_talent_documents AS
SELECT td.id, td.talent_id,
       td.original_filename, td.stored_filename, td.mime_type,
       td.file_size, td.file_url, td.document_type, td.category,
       td.status, td.processing_error, td.processed_at,
       td.tags, td.title, td.description,
       td.is_public, td.is_verified, td.verified_at, td.verified_by,
       td.verification_notes,
       td.created_at, td.updated_at,
       t.first_name || ' ' || t.last_name AS talent_name,
       t.email AS talent_email
FROM talent_documents td
JOIN talents t ON t.id = td.talent_id
WHERE td.deleted_at IS NULL;
