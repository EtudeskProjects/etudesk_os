-- 028_ai_pgvector_1024.sql
-- Move semantic storage from external vector DB / 1536d embeddings to local pgvector / 1024d embeddings.
--
-- Existing 1536d vectors cannot be cast to 1024d; the columns are reset and must
-- be re-embedded with: npm run pgvector:reset:seed

CREATE EXTENSION IF NOT EXISTS vector;

DROP VIEW IF EXISTS active_talents;
DROP VIEW IF EXISTS active_organizations;
DROP VIEW IF EXISTS active_communities;
DROP VIEW IF EXISTS active_opportunities;
DROP VIEW IF EXISTS active_spaces;
DROP VIEW IF EXISTS open_opportunities;

DROP INDEX IF EXISTS idx_talents_embedding;
DROP INDEX IF EXISTS idx_organizations_embedding;
DROP INDEX IF EXISTS idx_opportunities_embedding;
DROP INDEX IF EXISTS idx_communities_embedding;
DROP INDEX IF EXISTS idx_spaces_embedding;
DROP INDEX IF EXISTS idx_competencies_embedding;

ALTER TABLE talents ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE organizations ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE opportunities ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE communities ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE competencies ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_talents_embedding
  ON talents USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_embedding
  ON organizations USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_embedding
  ON opportunities USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communities_embedding
  ON communities USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spaces_embedding
  ON spaces USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competencies_embedding
  ON competencies USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE VIEW active_talents AS
SELECT *
FROM talents
WHERE deleted_at IS NULL;

CREATE VIEW active_organizations AS
SELECT *
FROM organizations
WHERE deleted_at IS NULL;

CREATE VIEW active_communities AS
SELECT *
FROM communities
WHERE deleted_at IS NULL;

CREATE VIEW active_opportunities AS
SELECT *
FROM opportunities
WHERE deleted_at IS NULL;

CREATE VIEW active_spaces AS
SELECT *
FROM spaces
WHERE deleted_at IS NULL;

CREATE VIEW open_opportunities AS
SELECT *
FROM opportunities
WHERE deleted_at IS NULL
  AND status = 'OPEN'
  AND (deadline IS NULL OR deadline > CURRENT_TIMESTAMP);
