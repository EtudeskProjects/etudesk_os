\pset pager off

BEGIN;

DO $$
DECLARE
    hub_talent_id UUID;
    hub_user_id UUID;
    hub_org_id UUID;
BEGIN
    SELECT id
    INTO hub_org_id
    FROM organizations
    WHERE slug = 'hubivoiretech'
      AND deleted_at IS NULL
    LIMIT 1;

    IF hub_org_id IS NULL THEN
        RAISE EXCEPTION 'Organisation hubivoiretech introuvable ou supprimee';
    END IF;

    SELECT id
    INTO hub_talent_id
    FROM talents
    WHERE lower(email) = lower('hello@hubtechivoire.ci')
      AND deleted_at IS NULL
    LIMIT 1;

    IF hub_talent_id IS NULL THEN
        INSERT INTO talents (
            slug,
            first_name,
            last_name,
            bio,
            email,
            city,
            region,
            country,
            profile_tags,
            goals,
            sectors,
            is_visible,
            created_at,
            updated_at
        )
        VALUES (
            'hubivoiretech',
            'HubIvoireTech',
            NULL,
            'Compte organisation HubIvoireTech.',
            'hello@hubtechivoire.ci',
            'Abidjan',
            'Abidjan',
            'CI',
            ARRAY['organization', 'coworking', 'tech-hub'],
            ARRAY['MANAGE_ORGANIZATION', 'MANAGE_SPACES'],
            ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
            TRUE,
            NOW(),
            NOW()
        )
        RETURNING id INTO hub_talent_id;
    ELSE
        UPDATE talents
        SET
            first_name = COALESCE(first_name, 'HubIvoireTech'),
            city = COALESCE(city, 'Abidjan'),
            region = COALESCE(region, 'Abidjan'),
            country = COALESCE(country, 'CI'),
            is_visible = TRUE,
            updated_at = NOW()
        WHERE id = hub_talent_id;
    END IF;

    SELECT id
    INTO hub_user_id
    FROM users
    WHERE lower(email) = lower('hello@hubtechivoire.ci')
      AND deleted_at IS NULL
    LIMIT 1;

    IF hub_user_id IS NULL THEN
        INSERT INTO users (
            email,
            email_verified,
            email_verified_at,
            talent_id,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            'hello@hubtechivoire.ci',
            TRUE,
            NOW(),
            hub_talent_id,
            TRUE,
            NOW(),
            NOW()
        )
        RETURNING id INTO hub_user_id;
    ELSE
        UPDATE users
        SET
            talent_id = hub_talent_id,
            email_verified = TRUE,
            email_verified_at = COALESCE(email_verified_at, NOW()),
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = hub_user_id;
    END IF;

    UPDATE organizations
    SET
        created_by = hub_talent_id,
        contact_email = COALESCE(NULLIF(btrim(contact_email), ''), 'hello@hubtechivoire.ci'),
        updated_at = NOW()
    WHERE id = hub_org_id;

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
        hub_org_id,
        hub_talent_id,
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

COMMIT;

SELECT org.slug, org.name, org.contact_email, t.email AS created_by_email, om.role, om.status, u.email_verified, u.is_active
FROM organizations org
LEFT JOIN talents t ON t.id = org.created_by
LEFT JOIN organization_members om ON om.organization_id = org.id AND om.talent_id = t.id
LEFT JOIN users u ON lower(u.email) = lower(t.email)
WHERE org.slug = 'hubivoiretech';
