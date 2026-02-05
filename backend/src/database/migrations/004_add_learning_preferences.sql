-- Migration: 004_add_learning_preferences
-- Adds learning_preferences JSONB column to talents table

ALTER TABLE talents
ADD COLUMN IF NOT EXISTS learning_preferences JSONB DEFAULT '{}'::jsonb;
