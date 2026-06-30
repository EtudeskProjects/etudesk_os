\pset pager off

BEGIN;

UPDATE communities
SET
    cover_image_url = '/uploads/illustrations/communities/anthropic-friends-claude-cover.jpg',
    images = ARRAY['/uploads/illustrations/communities/anthropic-friends-claude-cover.jpg'],
    updated_at = NOW()
WHERE slug = 'anthropic-friends-in-civ'
  AND deleted_at IS NULL;

COMMIT;

SELECT slug, name, cover_image_url, images
FROM communities
WHERE slug = 'anthropic-friends-in-civ';
