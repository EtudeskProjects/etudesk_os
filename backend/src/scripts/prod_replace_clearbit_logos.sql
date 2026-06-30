\pset pager off

BEGIN;

UPDATE organizations
SET
    logo_url = CASE slug
        WHEN 'mass-markets' THEN 'https://www.google.com/s2/favicons?domain=massmarkets.com&sz=256'
        WHEN 'myagro' THEN 'https://www.google.com/s2/favicons?domain=myagro.org&sz=256'
        WHEN 'phoenix-consulting-group-africa' THEN 'https://www.google.com/s2/favicons?domain=phoenixcga.com&sz=256'
        WHEN 'prosuma' THEN 'https://www.google.com/s2/favicons?domain=prosuma.ci&sz=256'
        WHEN 'the-flex' THEN 'https://www.google.com/s2/favicons?domain=theflex.global&sz=256'
        ELSE logo_url
    END,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND slug IN (
      'mass-markets',
      'myagro',
      'phoenix-consulting-group-africa',
      'prosuma',
      'the-flex'
  );

COMMIT;

SELECT slug, name, logo_url
FROM organizations
WHERE deleted_at IS NULL
ORDER BY name;
