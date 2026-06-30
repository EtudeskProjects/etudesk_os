-- 030_normalize_ai_usage_provider.sql
-- Collapse historical provider labels into the single provider-neutral value.

UPDATE ai_usage SET provider = 'ai' WHERE provider <> 'ai';

ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_provider_check;
ALTER TABLE ai_usage
  ADD CONSTRAINT ai_usage_provider_check CHECK (provider IN ('ai'));
