-- Migration 008: Add token tracking columns to copilot_traces
ALTER TABLE copilot_traces
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_tokens INTEGER DEFAULT 0;
