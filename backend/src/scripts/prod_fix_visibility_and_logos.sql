\pset pager off

BEGIN;

UPDATE organizations
SET
    is_visible = TRUE,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND is_visible IS DISTINCT FROM TRUE;

UPDATE organizations
SET
    logo_url = CASE slug
        WHEN 'etudesk-sas' THEN 'https://etudesk.com/images/etudesk_logo_black.png'
        WHEN 'hubivoiretech' THEN '/uploads/illustrations/spaces/hubivoiretech-atelier-brand.jpg'
        WHEN 'mass-markets' THEN 'https://logo.clearbit.com/massmarkets.com'
        WHEN 'myagro' THEN 'https://logo.clearbit.com/myagro.org'
        WHEN 'phoenix-consulting-group-africa' THEN 'https://logo.clearbit.com/phoenixcga.com'
        WHEN 'prosuma' THEN 'https://logo.clearbit.com/prosuma.ci'
        WHEN 'the-flex' THEN 'https://logo.clearbit.com/theflex.global'
        ELSE logo_url
    END,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND slug IN (
      'etudesk-sas',
      'hubivoiretech',
      'mass-markets',
      'myagro',
      'phoenix-consulting-group-africa',
      'prosuma',
      'the-flex'
  );

UPDATE opportunities
SET
    status = 'OPEN',
    visibility = 'PUBLIC',
    posted_at = COALESCE(posted_at, NOW()),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (status <> 'OPEN' OR visibility <> 'PUBLIC');

UPDATE communities
SET
    status = 'ACTIVE',
    visibility = 'PUBLIC',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC');

UPDATE spaces
SET
    status = 'ACTIVE',
    visibility = 'PUBLIC',
    is_bookable = TRUE,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC' OR is_bookable IS DISTINCT FROM TRUE);

COMMIT;

SELECT 'organizations_missing_logo' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL
  AND (logo_url IS NULL OR btrim(logo_url) = '');

SELECT 'organizations_not_visible' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL
  AND is_visible IS DISTINCT FROM TRUE;

SELECT 'opportunities_not_active_visible' AS check, count(*) AS count
FROM opportunities
WHERE deleted_at IS NULL
  AND (status <> 'OPEN' OR visibility <> 'PUBLIC');

SELECT 'communities_not_active_public' AS check, count(*) AS count
FROM communities
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC');

SELECT 'spaces_not_active_public_bookable' AS check, count(*) AS count
FROM spaces
WHERE deleted_at IS NULL
  AND (status <> 'ACTIVE' OR visibility <> 'PUBLIC' OR is_bookable IS DISTINCT FROM TRUE);

SELECT slug, name, is_visible, logo_url
FROM organizations
WHERE deleted_at IS NULL
ORDER BY name;
