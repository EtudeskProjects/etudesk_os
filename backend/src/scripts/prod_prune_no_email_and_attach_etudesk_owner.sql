\pset pager off

BEGIN;

DO $$
DECLARE
    owner_talent_id UUID;
    etudesk_org_id UUID;
BEGIN
    SELECT id
    INTO owner_talent_id
    FROM talents
    WHERE lower(email) = lower('lamine.barro@etudesk.org')
      AND deleted_at IS NULL
    LIMIT 1;

    IF owner_talent_id IS NULL THEN
        RAISE EXCEPTION 'Talent lamine.barro@etudesk.org introuvable ou supprime';
    END IF;

    SELECT id
    INTO etudesk_org_id
    FROM organizations
    WHERE slug = 'etudesk-sas'
      AND deleted_at IS NULL
    LIMIT 1;

    IF etudesk_org_id IS NULL THEN
        RAISE EXCEPTION 'Organisation etudesk-sas introuvable ou supprimee';
    END IF;

    UPDATE organizations
    SET
        created_by = owner_talent_id,
        updated_at = NOW()
    WHERE id = etudesk_org_id;

    INSERT INTO organization_members (
        organization_id,
        talent_id,
        role,
        permissions,
        status,
        joined_at,
        created_at,
        updated_at
    )
    VALUES (
        etudesk_org_id,
        owner_talent_id,
        'OWNER',
        ARRAY['ORG_ADMIN', 'BILLING', 'POST_OPPORTUNITIES', 'MANAGE_SPACES'],
        'ACTIVE',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (organization_id, talent_id) DO UPDATE SET
        role = 'OWNER',
        permissions = ARRAY['ORG_ADMIN', 'BILLING', 'POST_OPPORTUNITIES', 'MANAGE_SPACES'],
        status = 'ACTIVE',
        updated_at = NOW();
END $$;

WITH deleted_opportunities AS (
    UPDATE opportunities
    SET
        status = 'CLOSED',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND (
          external_apply_email IS NULL
          OR btrim(external_apply_email) = ''
      )
    RETURNING id
)
SELECT 'deleted_opportunities_without_email' AS action, count(*) AS count
FROM deleted_opportunities;

WITH deleted_organizations AS (
    UPDATE organizations
    SET
        is_visible = FALSE,
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND slug <> 'hubivoiretech'
      AND (
          contact_email IS NULL
          OR btrim(contact_email) = ''
      )
    RETURNING id
)
SELECT 'deleted_organizations_without_email' AS action, count(*) AS count
FROM deleted_organizations;

COMMIT;

SELECT 'remaining_open_external_jobs' AS check, count(*) AS count
FROM opportunities
WHERE application_mode = 'EMAIL'
  AND status = 'OPEN'
  AND deleted_at IS NULL;

SELECT 'remaining_open_external_jobs_without_email' AS check, count(*) AS count
FROM opportunities
WHERE application_mode = 'EMAIL'
  AND status = 'OPEN'
  AND deleted_at IS NULL
  AND (external_apply_email IS NULL OR btrim(external_apply_email) = '');

SELECT 'remaining_visible_orgs_without_email_except_hubivoiretech' AS check, count(*) AS count
FROM organizations
WHERE deleted_at IS NULL
  AND is_visible = TRUE
  AND slug <> 'hubivoiretech'
  AND (contact_email IS NULL OR btrim(contact_email) = '');

SELECT org.slug, org.name, t.email AS created_by_email, om.role, om.status
FROM organizations org
LEFT JOIN talents t ON t.id = org.created_by
LEFT JOIN organization_members om
    ON om.organization_id = org.id
LEFT JOIN talents mt
    ON mt.id = om.talent_id
   AND lower(mt.email) = lower('lamine.barro@etudesk.org')
WHERE org.slug = 'etudesk-sas'
ORDER BY om.role NULLS LAST
LIMIT 5;
