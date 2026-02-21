-- Migration 006: Copilot Traces (DPO Analytics)
-- Captures execution metrics and user feedback for each copilot interaction.
-- Enables DPO-style learning: preferred/rejected trajectory pairs via user_rating.

CREATE TABLE IF NOT EXISTS copilot_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES copilot_messages(id) ON DELETE SET NULL,
  talent_id UUID NOT NULL,
  organization_id UUID,
  mode VARCHAR(20) NOT NULL,
  skill_id VARCHAR(100),

  -- Execution metrics
  turn_count INTEGER NOT NULL DEFAULT 0,
  tool_count INTEGER NOT NULL DEFAULT 0,
  tool_names TEXT[] DEFAULT '{}',
  tool_errors INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,

  -- Outcome signals (auto-detected)
  has_tool_error BOOLEAN NOT NULL DEFAULT false,
  hit_loop_detection BOOLEAN NOT NULL DEFAULT false,
  hit_turn_limit BOOLEAN NOT NULL DEFAULT false,
  guardrail_blocked BOOLEAN NOT NULL DEFAULT false,

  -- User feedback (DPO signal)
  -- NULL = no feedback, 1 = thumbs down, 3 = thumbs up
  user_rating SMALLINT CHECK (user_rating IN (1, 3)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups for analytics
CREATE INDEX idx_copilot_traces_talent ON copilot_traces(talent_id, created_at DESC);
CREATE INDEX idx_copilot_traces_skill ON copilot_traces(skill_id, user_rating) WHERE skill_id IS NOT NULL;
CREATE INDEX idx_copilot_traces_message ON copilot_traces(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_copilot_traces_org ON copilot_traces(organization_id, created_at DESC) WHERE organization_id IS NOT NULL;

-- For DPO few-shot queries: winning trajectories per skill
CREATE INDEX idx_copilot_traces_dpo ON copilot_traces(skill_id, user_rating, created_at DESC)
  WHERE user_rating = 3 AND tool_errors = 0;
