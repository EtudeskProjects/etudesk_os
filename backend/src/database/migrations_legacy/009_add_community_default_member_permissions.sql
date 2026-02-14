-- Default permissions for new members (JSONB: can_post, can_create_event, can_create_poll)
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS default_member_permissions JSONB DEFAULT '{"can_post": true, "can_create_event": false, "can_create_poll": false}'::jsonb;
