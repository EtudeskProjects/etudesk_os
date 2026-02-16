-- Allow explicit org copilot mode persistence
ALTER TABLE copilot_sessions
  DROP CONSTRAINT IF EXISTS copilot_sessions_mode_check;

ALTER TABLE copilot_sessions
  ADD CONSTRAINT copilot_sessions_mode_check
  CHECK (mode IN ('explore', 'study', 'org'));
