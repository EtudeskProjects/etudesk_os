\pset pager off

BEGIN;

-- PostgreSQL POINT is stored as (x, y). We store longitude as x and latitude as y.
UPDATE organizations
SET
    headquarters_coordinates = point(-3.960667, 5.398085),
    headquarters_city = COALESCE(headquarters_city, 'Abidjan'),
    headquarters_region = COALESCE(headquarters_region, 'Abidjan'),
    headquarters_country = COALESCE(headquarters_country, 'CI'),
    updated_at = NOW()
WHERE slug = 'etudesk-sas'
  AND deleted_at IS NULL;

UPDATE organizations
SET
    headquarters_coordinates = point(-4.017096, 5.325412),
    headquarters_city = COALESCE(headquarters_city, 'Abidjan'),
    headquarters_region = COALESCE(headquarters_region, 'Abidjan'),
    headquarters_country = COALESCE(headquarters_country, 'CI'),
    updated_at = NOW()
WHERE slug = 'hubivoiretech'
  AND deleted_at IS NULL;

UPDATE spaces
SET
    coordinates = point(-4.017096, 5.325412),
    address = 'Tour Postel 2001, Plateau, Abidjan, Côte d''Ivoire',
    city = 'Abidjan',
    region = 'Abidjan',
    country = 'CI',
    updated_at = NOW()
WHERE slug IN ('hubivoiretech-atelier', 'hubivoiretech-places-coworking')
  AND deleted_at IS NULL;

UPDATE communities
SET
    coordinates = point(-3.960667, 5.398085),
    city = COALESCE(city, 'Abidjan'),
    region = COALESCE(region, 'Abidjan'),
    country = COALESCE(country, 'CI'),
    updated_at = NOW()
WHERE organization_id = (
    SELECT id FROM organizations WHERE slug = 'etudesk-sas' AND deleted_at IS NULL LIMIT 1
)
  AND deleted_at IS NULL;

COMMIT;

SELECT slug, name, headquarters_coordinates
FROM organizations
WHERE slug IN ('etudesk-sas', 'hubivoiretech')
ORDER BY slug;

SELECT slug, name, address, coordinates
FROM spaces
WHERE slug IN ('hubivoiretech-atelier', 'hubivoiretech-places-coworking')
ORDER BY slug;

SELECT slug, name, coordinates
FROM communities
WHERE organization_id = (
    SELECT id FROM organizations WHERE slug = 'etudesk-sas' AND deleted_at IS NULL LIMIT 1
)
ORDER BY slug;
