-- Migration 026: Unified AI usage / token accounting
-- Single table that records every LLM/AI call so we can
-- compute true COGS per feature and never "vendre du token non comptabilise".
-- All previously-untracked paths (guardrails, summarizer, titles, suggestions,
-- STT/TTS, embeddings, KYC, extraction, image gen, web search) write here.

CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What was called
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('ai')),
    model VARCHAR(80) NOT NULL,
    feature VARCHAR(80) NOT NULL,            -- e.g. copilot_agent, guardrail, summarizer, kyc, embedding, image, tts, stt, web_search
    billed_action_code VARCHAR(80),          -- credit_action_catalog action_code if this call was billed, else NULL

    -- Who triggered it (nullable: some calls are background/seed)
    talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    session_id UUID,                         -- copilot_sessions.id when applicable (no FK: keep usage even if session purged)

    -- Token / unit counters
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,  -- cache WRITE (was never tracked before)
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    audio_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- Money
    cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,   -- computed COGS at record time (pricing snapshot)

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_created ON ai_usage (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_talent ON ai_usage (talent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org ON ai_usage (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_session ON ai_usage (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage (billed_action_code, created_at DESC);
