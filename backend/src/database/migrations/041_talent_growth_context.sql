-- Derived, explainable long-term context for a talent. This only reflects
-- explicit profile choices and observable product activity; never beliefs,
-- identity or inferred sensitive traits.

ALTER TABLE talent_progressions
  ADD COLUMN IF NOT EXISTS growth_context JSONB NOT NULL DEFAULT '{}'::jsonb;
