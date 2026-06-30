\pset pager off

BEGIN;

UPDATE organizations
SET
    logo_url = '/uploads/logos/organizations/etudesk-logo.png',
    updated_at = NOW()
WHERE slug = 'etudesk-sas'
  AND deleted_at IS NULL;

UPDATE organizations
SET
    logo_url = '/uploads/logos/organizations/hubivoiretech-logo.jpg',
    updated_at = NOW()
WHERE slug = 'hubivoiretech'
  AND deleted_at IS NULL;

COMMIT;

SELECT slug, name, logo_url
FROM organizations
WHERE slug IN ('etudesk-sas', 'hubivoiretech')
ORDER BY slug;
