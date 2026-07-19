-- Persistent, non-UI backbone for a talent's long-term digital progression.
-- Existing product primitives remain their own sources of truth; this table only
-- stores the derived state and references to signals that inform it.

CREATE TABLE IF NOT EXISTS talent_progressions (
  talent_id UUID PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
  direction VARCHAR(100) NOT NULL DEFAULT 'digital_skills',
  status VARCHAR(30) NOT NULL DEFAULT 'EXPLORING',
  priority_competencies TEXT[] NOT NULL DEFAULT '{}',
  current_focus JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_signal_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_talent_progressions_status CHECK (status IN ('EXPLORING', 'ACTIVE', 'REORIENTING', 'PAUSED'))
);

CREATE TABLE IF NOT EXISTS talent_progression_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id TEXT NOT NULL,
  signal_type VARCHAR(80) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (talent_id, source_type, source_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_talent_progression_signals_talent_time
  ON talent_progression_signals (talent_id, occurred_at DESC);
