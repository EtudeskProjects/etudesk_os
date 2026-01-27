-- Migration: Hub compliance fields (SKIPPED)
-- Date: 2026-01-25
-- Description: This migration was for the old 'hubs' table which has been replaced by 'spaces'.
-- The equivalent fields have been added to the spaces table in migration 030_replace_hubs_with_spaces.sql

-- NO-OP: Hubs table no longer exists, replaced by spaces
SELECT 1;
