-- 022_competencies_embedding.sql
-- The skills referential (migration 021) created `competencies` without the
-- pgvector column that catalog.service and seed:competency-embeddings require
-- for semantic skill resolution (find_competency, manage_skills, matching,
-- document extraction). Add it here so fresh installs and existing DBs match.
-- pgvector is already enabled by migration 001 (CREATE EXTENSION "vector").

ALTER TABLE competencies ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
