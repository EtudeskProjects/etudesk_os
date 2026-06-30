\pset pager off

SELECT 'organizations_total_visible' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL;

SELECT 'organizations_missing_logo' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL
  AND (logo_url IS NULL OR btrim(logo_url) = '');

SELECT 'organizations_not_visible' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL
  AND is_visible IS DISTINCT FROM TRUE;

SELECT slug, name, is_visible, logo_url, contact_email
FROM organizations
WHERE deleted_at IS NULL
ORDER BY name;

SELECT 'open_opportunities' AS check, count(*) AS count
FROM opportunities
WHERE deleted_at IS NULL
  AND status = 'OPEN'
  AND visibility = 'PUBLIC';

SELECT 'opportunities_not_active_visible' AS check, count(*) AS count
FROM opportunities
WHERE deleted_at IS NULL
  AND (status <> 'OPEN' OR visibility <> 'PUBLIC');

SELECT org.name AS organization, o.slug, o.title, o.status, o.visibility, o.application_mode
FROM opportunities o
LEFT JOIN organizations org ON org.id = o.organization_id
WHERE o.deleted_at IS NULL
ORDER BY o.posted_at DESC NULLS LAST, o.created_at DESC;

SELECT 'communities_active_public' AS check, count(*) AS count
FROM communities
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND visibility = 'PUBLIC';

SELECT 'communities_not_active_public' AS check, count(*) AS count
FROM communities
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC');

SELECT c.slug, c.name, org.name AS organization, c.status, c.visibility, c.cover_image_url
FROM communities c
LEFT JOIN organizations org ON org.id = c.organization_id
WHERE c.deleted_at IS NULL
ORDER BY c.name;

SELECT 'spaces_active_public_bookable' AS check, count(*) AS count
FROM spaces
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND visibility = 'PUBLIC'
  AND is_bookable = TRUE;

SELECT 'spaces_not_active_public_bookable' AS check, count(*) AS count
FROM spaces
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC' OR is_bookable IS DISTINCT FROM TRUE);

SELECT s.slug, s.name, org.name AS organization, s.status, s.visibility, s.is_bookable, s.cover_image_url
FROM spaces s
LEFT JOIN organizations org ON org.id = s.organization_id
WHERE s.deleted_at IS NULL
ORDER BY s.name;
