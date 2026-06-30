BEGIN;

UPDATE spaces
SET
    cover_image_url = '/uploads/illustrations/spaces/hubivoiretech-coworking-open-desks.jpg',
    gallery_images = ARRAY[
        '/uploads/illustrations/spaces/hubivoiretech-coworking-open-desks.jpg',
        '/uploads/illustrations/spaces/hubivoiretech-coworking-window-desks.jpg'
    ],
    updated_at = NOW()
WHERE slug = 'hubivoiretech-places-coworking'
  AND deleted_at IS NULL;

UPDATE spaces
SET
    cover_image_url = '/uploads/illustrations/spaces/hubivoiretech-atelier-fablab-wide.jpg',
    gallery_images = ARRAY[
        '/uploads/illustrations/spaces/hubivoiretech-atelier-fablab-wide.jpg',
        '/uploads/illustrations/spaces/hubivoiretech-atelier-machines.jpg',
        '/uploads/illustrations/spaces/hubivoiretech-atelier-brand.jpg'
    ],
    updated_at = NOW()
WHERE slug = 'hubivoiretech-atelier'
  AND deleted_at IS NULL;

COMMIT;
