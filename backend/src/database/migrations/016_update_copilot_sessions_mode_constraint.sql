-- Migration: Update copilot_sessions mode constraint to allow both explore and study modes

ALTER TABLE copilot_sessions DROP CONSTRAINT IF EXISTS copilot_sessions_mode_check;
ALTER TABLE copilot_sessions ADD CONSTRAINT copilot_sessions_mode_check CHECK (mode IN ('explore', 'study'));
