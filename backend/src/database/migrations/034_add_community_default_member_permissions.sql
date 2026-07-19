-- 034 — Community default member permissions
-- Aligns the communities table with the community creation and permission APIs.

ALTER TABLE communities
    ADD COLUMN IF NOT EXISTS default_member_permissions JSONB DEFAULT '{"can_post": true, "can_create_event": false, "can_create_poll": false}'::jsonb;
