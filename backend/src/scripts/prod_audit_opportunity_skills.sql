\pset pager off

SELECT
    o.slug,
    org.name AS organization,
    o.title,
    o.type AS opportunity_type,
    o.application_mode,
    count(os.competency_slug) AS skill_count,
    count(DISTINCT c.type) AS skill_type_count,
    string_agg(DISTINCT c.type, ', ' ORDER BY c.type) AS skill_types
FROM opportunities o
LEFT JOIN organizations org ON org.id = o.organization_id
LEFT JOIN opportunity_skills os ON os.opportunity_id = o.id
LEFT JOIN competencies c ON c.slug = os.competency_slug
WHERE o.deleted_at IS NULL
  AND o.status = 'OPEN'
  AND o.visibility = 'PUBLIC'
GROUP BY o.slug, org.name, o.title, o.type, o.application_mode
ORDER BY org.name, o.title;

SELECT
    o.slug,
    c.slug AS competency_slug,
    c.name,
    c.name_fr,
    c.type,
    c.family,
    os.requirement,
    os.weight,
    os.min_level
FROM opportunities o
JOIN opportunity_skills os ON os.opportunity_id = o.id
JOIN competencies c ON c.slug = os.competency_slug
WHERE o.deleted_at IS NULL
  AND o.status = 'OPEN'
  AND o.visibility = 'PUBLIC'
ORDER BY o.slug, os.requirement, c.type, c.name;
