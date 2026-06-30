\pset pager off

BEGIN;

UPDATE communities
SET
    cover_image_url = '/uploads/illustrations/communities/etudesk-updates-cover.jpg',
    images = ARRAY['/uploads/illustrations/communities/etudesk-updates-cover.jpg'],
    updated_at = NOW()
WHERE slug = 'etudesk-updates'
  AND deleted_at IS NULL;

COMMIT;

SELECT slug, name, cover_image_url, images
FROM communities
WHERE slug = 'etudesk-updates';
