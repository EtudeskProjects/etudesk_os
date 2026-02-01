-- ═══════════════════════════════════════════════════════════════
-- Migration: 044_skill_model_fixes
-- Description: Add proper constraints on skill types, proficiency levels,
--              and origin tracking for talent_skills
-- ═══════════════════════════════════════════════════════════════

-- 1. Add CHECK constraint on skills.type
-- Values: knowledge (savoir), know_how (savoir-faire), know_being (savoir-être)
ALTER TABLE skills
  DROP CONSTRAINT IF EXISTS skills_type_check;

ALTER TABLE skills
  ADD CONSTRAINT skills_type_check
  CHECK (type IN ('knowledge', 'know_how', 'know_being'));

-- 2. Add CHECK constraint on talent_skills.proficiency_level
ALTER TABLE talent_skills
  DROP CONSTRAINT IF EXISTS talent_skills_proficiency_level_check;

ALTER TABLE talent_skills
  ADD CONSTRAINT talent_skills_proficiency_level_check
  CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'));

-- 3. Add origin column to talent_skills (how the skill was acquired/detected)
-- declared = user manually added it
-- inferred = AI inferred from profile/activity
-- extracted = extracted from uploaded documents
ALTER TABLE talent_skills
  ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'declared'
  CHECK (origin IN ('declared', 'inferred', 'extracted'));

-- 4. Add authenticity_score to talent_documents (0.0 to 1.0)
ALTER TABLE talent_documents
  ADD COLUMN IF NOT EXISTS authenticity_score NUMERIC(3,2) DEFAULT NULL;

-- 5. Add min/max skill extraction constraints as comment
-- Business rule: documents should extract between 3 and 30 skills
-- Enforced at application level in extraction.service.ts

-- 6. Index for origin queries
CREATE INDEX IF NOT EXISTS idx_talent_skills_origin ON talent_skills(origin);
