\pset pager off
\x off

SELECT 'organizations_foundation' AS check, count(*) AS count
FROM organizations
WHERE slug IN ('etudesk-sas', 'hubivoiretech') AND deleted_at IS NULL;

SELECT slug, name, contact_email, verification_status, is_visible
FROM organizations
WHERE slug IN ('etudesk-sas', 'hubivoiretech')
ORDER BY slug;

SELECT c.slug, c.name, org.name AS organization, c.type, c.status
FROM communities c
JOIN organizations org ON org.id = c.organization_id
WHERE c.slug IN ('anthropic-friends-in-civ', 'etudesk-updates')
ORDER BY c.slug;

SELECT s.slug, s.name, org.name AS organization, s.type, s.daily_rate, s.monthly_rate, s.status
FROM spaces s
JOIN organizations org ON org.id = s.organization_id
WHERE s.slug IN ('hubivoiretech-places-coworking', 'hubivoiretech-atelier')
ORDER BY s.slug;

SELECT 'external_jobs' AS check, count(*) AS count
FROM opportunities
WHERE application_mode = 'EMAIL' AND deleted_at IS NULL;

SELECT 'external_jobs_missing_email' AS check, count(*) AS count
FROM opportunities
WHERE application_mode = 'EMAIL'
  AND deleted_at IS NULL
  AND (external_apply_email IS NULL OR external_apply_email = '');

SELECT org.name AS organization, o.title, o.external_apply_email
FROM opportunities o
JOIN organizations org ON org.id = o.organization_id
WHERE o.application_mode = 'EMAIL'
  AND o.deleted_at IS NULL
ORDER BY org.name, o.title;
