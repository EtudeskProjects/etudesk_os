-- Migration: 046_community_members_extra_columns
-- Add missing columns used by backend routes

ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS rating SMALLINT;

ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS unread_messages INTEGER DEFAULT 0;
