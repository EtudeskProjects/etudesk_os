-- Enhanced skill extraction: add document_id and extraction_context to talent_skills
ALTER TABLE talent_skills ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES talent_documents(id);
ALTER TABLE talent_skills ADD COLUMN IF NOT EXISTS extraction_context TEXT;
CREATE INDEX IF NOT EXISTS idx_talent_skills_document ON talent_skills(document_id) WHERE document_id IS NOT NULL;
