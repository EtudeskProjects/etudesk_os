BEGIN;

INSERT INTO organizations (
    name, slug, types, sectors, description, logo_url, website_url, contact_email,
    headquarters_city, headquarters_region, headquarters_country, verification_status, is_visible
) VALUES (
    'Etudesk SAS',
    'etudesk-sas',
    ARRAY['STARTUP', 'EDTECH', 'TALENTTECH'],
    ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
    'Plateforme ivoirienne de compétences, communautés, opportunités et espaces pour les talents et organisations.',
    'https://etudesk.com/images/etudesk_logo_black.png',
    'https://etudesk.com',
    'contact@etudesk.com',
    'Abidjan',
    'Abidjan',
    'CI',
    'OFFICIAL',
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    types = EXCLUDED.types,
    sectors = EXCLUDED.sectors,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    website_url = EXCLUDED.website_url,
    contact_email = EXCLUDED.contact_email,
    headquarters_city = EXCLUDED.headquarters_city,
    headquarters_region = EXCLUDED.headquarters_region,
    headquarters_country = EXCLUDED.headquarters_country,
    verification_status = EXCLUDED.verification_status,
    is_visible = EXCLUDED.is_visible,
    updated_at = NOW();

INSERT INTO organizations (
    name, slug, types, sectors, description, logo_url, website_url, contact_email,
    headquarters_city, headquarters_region, headquarters_country, verification_status, is_visible
) VALUES (
    'HubIvoireTech',
    'hubivoiretech',
    ARRAY['COWORKING', 'TECH_HUB', 'TRAINING_CENTER'],
    ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
    'Hub tech et coworking ivoirien pour ateliers, travail partagé et rencontres autour des métiers du numérique.',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80',
    NULL,
    NULL,
    'Abidjan',
    'Abidjan',
    'CI',
    'OFFICIAL',
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    types = EXCLUDED.types,
    sectors = EXCLUDED.sectors,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    website_url = EXCLUDED.website_url,
    contact_email = EXCLUDED.contact_email,
    headquarters_city = EXCLUDED.headquarters_city,
    headquarters_region = EXCLUDED.headquarters_region,
    headquarters_country = EXCLUDED.headquarters_country,
    verification_status = EXCLUDED.verification_status,
    is_visible = EXCLUDED.is_visible,
    updated_at = NOW();

WITH etudesk AS (
    SELECT id FROM organizations WHERE slug = 'etudesk-sas'
)
INSERT INTO communities (
    name, slug, type, description, rules, access_type, visibility, tags, sectors,
    city, region, country, cover_image_url, is_paid, status, organization_id
)
SELECT
    'Anthropic Friends in CIV 🇨🇮',
    'anthropic-friends-in-civ',
    'ONLINE',
    'Communauté ivoirienne autour des usages, pratiques et opportunités liés à Anthropic, Claude et l''IA appliquée.',
    'Partage utile, respect professionnel et entraide entre praticiens.',
    'PUBLIC',
    'PUBLIC',
    '["TECH","AI","PROFESSIONAL"]'::jsonb,
    '["DIGITAL","EDUCATION","PROFESSIONAL_SERVICES"]'::jsonb,
    'Abidjan',
    'Abidjan',
    'CI',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80',
    FALSE,
    'ACTIVE',
    etudesk.id
FROM etudesk
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    description = EXCLUDED.description,
    rules = EXCLUDED.rules,
    access_type = EXCLUDED.access_type,
    visibility = EXCLUDED.visibility,
    tags = EXCLUDED.tags,
    sectors = EXCLUDED.sectors,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    cover_image_url = EXCLUDED.cover_image_url,
    is_paid = EXCLUDED.is_paid,
    status = EXCLUDED.status,
    organization_id = EXCLUDED.organization_id,
    updated_at = NOW();

WITH etudesk AS (
    SELECT id FROM organizations WHERE slug = 'etudesk-sas'
)
INSERT INTO communities (
    name, slug, type, description, rules, access_type, visibility, tags, sectors,
    city, region, country, cover_image_url, is_paid, status, organization_id
)
SELECT
    'Etudesk Updates',
    'etudesk-updates',
    'ONLINE',
    'Canal officiel des annonces, nouveautés produit, opportunités et actualités Etudesk.',
    'Informations officielles Etudesk et échanges utiles autour de la plateforme.',
    'PUBLIC',
    'PUBLIC',
    '["TECH","PROFESSIONAL","YOUTH"]'::jsonb,
    '["DIGITAL","EDUCATION","PROFESSIONAL_SERVICES"]'::jsonb,
    'Abidjan',
    'Abidjan',
    'CI',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80',
    FALSE,
    'ACTIVE',
    etudesk.id
FROM etudesk
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    description = EXCLUDED.description,
    rules = EXCLUDED.rules,
    access_type = EXCLUDED.access_type,
    visibility = EXCLUDED.visibility,
    tags = EXCLUDED.tags,
    sectors = EXCLUDED.sectors,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    cover_image_url = EXCLUDED.cover_image_url,
    is_paid = EXCLUDED.is_paid,
    status = EXCLUDED.status,
    organization_id = EXCLUDED.organization_id,
    updated_at = NOW();

WITH hub AS (
    SELECT id FROM organizations WHERE slug = 'hubivoiretech'
)
INSERT INTO spaces (
    name, slug, description, type, surface_m2, capacity, floor_number, address, city, region, country,
    equipment, amenities, sectors, is_accessible, cover_image_url, gallery_images,
    daily_rate, monthly_rate, is_bookable, min_booking_hours, max_booking_hours, visibility,
    booking_rules, requires_approval, contact_name, organization_id, status
)
SELECT
    'Places coworking HubIvoireTech',
    'hubivoiretech-places-coworking',
    'Postes de coworking flexibles pour talents, équipes projet et freelances du numérique.',
    'POSTE_NOMADE',
    120,
    30,
    0,
    'Abidjan, Côte d''Ivoire',
    'Abidjan',
    'Abidjan',
    'CI',
    ARRAY['WIFI', 'DESK', 'POWER_OUTLETS', 'WHITEBOARD'],
    ARRAY['WIFI', 'AIR_CONDITIONING', 'CAFETERIA', 'RESTROOMS', 'RECEPTION', 'SECURITY', 'NATURAL_LIGHT'],
    ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
    TRUE,
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80',
    ARRAY['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80'],
    5000,
    50000,
    TRUE,
    1,
    24,
    'PUBLIC',
    ARRAY['Tarif coworking: 5 000 XOF par jour ou 50 000 XOF par mois.', 'Réservation soumise aux disponibilités.'],
    FALSE,
    'HubIvoireTech',
    hub.id,
    'ACTIVE'
FROM hub
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    surface_m2 = EXCLUDED.surface_m2,
    capacity = EXCLUDED.capacity,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    equipment = EXCLUDED.equipment,
    amenities = EXCLUDED.amenities,
    sectors = EXCLUDED.sectors,
    is_accessible = EXCLUDED.is_accessible,
    cover_image_url = EXCLUDED.cover_image_url,
    gallery_images = EXCLUDED.gallery_images,
    daily_rate = EXCLUDED.daily_rate,
    monthly_rate = EXCLUDED.monthly_rate,
    is_bookable = EXCLUDED.is_bookable,
    min_booking_hours = EXCLUDED.min_booking_hours,
    max_booking_hours = EXCLUDED.max_booking_hours,
    visibility = EXCLUDED.visibility,
    booking_rules = EXCLUDED.booking_rules,
    requires_approval = EXCLUDED.requires_approval,
    contact_name = EXCLUDED.contact_name,
    organization_id = EXCLUDED.organization_id,
    status = EXCLUDED.status,
    updated_at = NOW();

WITH hub AS (
    SELECT id FROM organizations WHERE slug = 'hubivoiretech'
)
INSERT INTO spaces (
    name, slug, description, type, surface_m2, capacity, floor_number, address, city, region, country,
    equipment, amenities, sectors, is_accessible, cover_image_url, gallery_images,
    daily_rate, monthly_rate, is_bookable, min_booking_hours, max_booking_hours, visibility,
    booking_rules, requires_approval, contact_name, organization_id, status
)
SELECT
    'Atelier HubIvoireTech',
    'hubivoiretech-atelier',
    'Salle atelier pour formations courtes, bootcamps, meetups techniques et sessions de travail collaboratif.',
    'ATELIER',
    80,
    20,
    0,
    'Abidjan, Côte d''Ivoire',
    'Abidjan',
    'Abidjan',
    'CI',
    ARRAY['WIFI', 'PROJECTOR', 'WHITEBOARD', 'POWER_OUTLETS'],
    ARRAY['WIFI', 'AIR_CONDITIONING', 'CAFETERIA', 'RESTROOMS', 'RECEPTION', 'SECURITY', 'NATURAL_LIGHT'],
    ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
    TRUE,
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80',
    ARRAY['https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80'],
    8000,
    NULL,
    TRUE,
    1,
    24,
    'PUBLIC',
    ARRAY['Tarif atelier: 8 000 XOF par jour.', 'Réservation soumise aux disponibilités.'],
    FALSE,
    'HubIvoireTech',
    hub.id,
    'ACTIVE'
FROM hub
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    surface_m2 = EXCLUDED.surface_m2,
    capacity = EXCLUDED.capacity,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    equipment = EXCLUDED.equipment,
    amenities = EXCLUDED.amenities,
    sectors = EXCLUDED.sectors,
    is_accessible = EXCLUDED.is_accessible,
    cover_image_url = EXCLUDED.cover_image_url,
    gallery_images = EXCLUDED.gallery_images,
    daily_rate = EXCLUDED.daily_rate,
    monthly_rate = EXCLUDED.monthly_rate,
    is_bookable = EXCLUDED.is_bookable,
    min_booking_hours = EXCLUDED.min_booking_hours,
    max_booking_hours = EXCLUDED.max_booking_hours,
    visibility = EXCLUDED.visibility,
    booking_rules = EXCLUDED.booking_rules,
    requires_approval = EXCLUDED.requires_approval,
    contact_name = EXCLUDED.contact_name,
    organization_id = EXCLUDED.organization_id,
    status = EXCLUDED.status,
    updated_at = NOW();

WITH title_updates(organization_name, old_title, external_apply_url, new_title, official_email) AS (
    VALUES
        ('PHOENIX CONSULTING GROUP AFRICA', 'Formateur Tech', 'https://projobivoire.com/jobs/formateur-tech-yamoussoukro/', 'Formateur tech', 'recrutementpcgci@phoenixcga.com'),
        ('PROSUMA', 'Agent Tracking', 'https://projobivoire.com/jobs/prosuma-recrute-agent-tracking-bac2/', 'Agent tracking', 'recrutement@prosuma.ci'),
        ('myAgro', 'Software Engineer', 'https://ci.linkedin.com/jobs/view/software-engineer-at-myagro-4422476318', 'Software engineer', 'info@myagro.org'),
        ('The Flex', 'Full-Stack Product Engineer', 'https://ci.linkedin.com/jobs/view/full-stack-product-engineer-at-the-flex-4429160724', 'Full-stack product engineer', 'info@theflex.global'),
        ('The Flex', 'Software Engineer', 'https://ci.linkedin.com/jobs/view/software-engineer-at-the-flex-4429155768', 'Software engineer', 'info@theflex.global'),
        ('Africa Global Logistics', 'CHARGE DE SUPPORT DATA & BI H/F', 'https://ci.linkedin.com/jobs/view/charge-de-support-data-bi-h-f-at-africa-global-logistics-4428929160', 'Chargé de support data & BI H/F', NULL),
        ('Orange Cote d''Ivoire', 'Administrateur de base de donnees/Administratrice de base de donnees', 'https://ci.linkedin.com/jobs/view/administrateur-de-base-de-donnees-administratrice-de-base-de-donnees-at-orange-cote-d-ivoire-4430711066', 'Administrateur de base de données / administratrice de base de données', NULL),
        ('Africa Global Logistics', 'CHARGE DE TEST', 'https://ci.linkedin.com/jobs/view/charge-de-test-at-africa-global-logistics-4426411208', 'Chargé de test', NULL),
        ('Prysmian', 'Analyste Applications informatiques / Ivory Coast IT Application Analyst', 'https://ci.linkedin.com/jobs/view/analyste-applications-informatiques-ivory-coast-it-application-analyst-at-prysmian-4421361929', 'Analyste applications informatiques / Ivory Coast IT application analyst', NULL),
        ('Wave Mobile Money', 'Regional IT Manager', 'https://ci.linkedin.com/jobs/view/regional-it-manager-at-wave-mobile-money-4434467032', 'Regional IT manager', NULL),
        ('Mass Markets', 'AI / Machine Learning Engineer - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-machine-learning-engineer-talent-pool-at-mass-markets-4425309414', 'AI / machine learning engineer - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'AI Agent Developer - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-agent-developer-talent-pool-at-mass-markets-4424897682', 'AI agent developer - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'AI Prompt Engineer - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-prompt-engineer-talent-pool-at-mass-markets-4425311243', 'AI prompt engineer - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'AI Data Annotator - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-data-annotator-talent-pool-at-mass-markets-4425305632', 'AI data annotator - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'AI Security Analyst - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-security-analyst-talent-pool-at-mass-markets-4424891783', 'AI security analyst - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'Responsible AI Specialist - Talent Pool', 'https://ci.linkedin.com/jobs/view/responsible-ai-specialist-talent-pool-at-mass-markets-4424896710', 'Responsible AI specialist - Talent pool', 'humanresources@mci.world'),
        ('Mass Markets', 'AI Chatbot Tester - Talent Pool', 'https://ci.linkedin.com/jobs/view/ai-chatbot-tester-talent-pool-at-mass-markets-4424899689', 'AI chatbot tester - Talent pool', 'humanresources@mci.world'),
        ('Crossing Hurdles', 'Dioula Transcription & Annotation Specialist', 'https://ci.linkedin.com/jobs/view/dioula-transcription-annotation-specialist-%2495-hr-remote-at-crossing-hurdles-4432242363', 'Dioula transcription & annotation specialist', NULL),
        ('Save the Children International', 'Intern Data Analyst, Data Insights', 'https://ci.linkedin.com/jobs/view/intern-data-analyst-data-insights-at-save-the-children-international-4433833381', 'Intern data analyst, data insights', NULL),
        ('Neemba Group', 'Analyste Marche', 'https://ci.linkedin.com/jobs/view/analyste-marche-at-neemba-group-4429267289', 'Analyste marché', NULL),
        ('Promasidor', 'Group Commercial Analytics Manager', 'https://ci.linkedin.com/jobs/view/group-commercial-analytics-manager-at-promasidor-4432597869', 'Group commercial analytics manager', NULL),
        ('BOA CI', 'INGENIEUR EXPLOITATION-APPLICATIONS H/F', 'https://www.novojob.com/cote-d-ivoire/offres-emploi/informatique', 'Ingénieur exploitation-applications H/F', NULL),
        ('GIZ Cote d''Ivoire', 'Specialiste de la gestion du savoir, des donnees et des systemes d''information', 'https://www.novojob.com/cote-d-ivoire/offres-emploi/informatique', 'Spécialiste de la gestion du savoir, des données et des systèmes d''information', NULL)
)
UPDATE opportunities o
SET
    title = u.new_title,
    external_apply_email = COALESCE(u.official_email, o.external_apply_email),
    updated_at = NOW()
FROM title_updates u
JOIN organizations org ON org.name = u.organization_name
WHERE o.organization_id = org.id
  AND o.application_mode = 'EMAIL'
  AND o.external_apply_url = u.external_apply_url
  AND o.title = u.old_title
  AND o.deleted_at IS NULL;

UPDATE organizations
SET contact_email = 'recrutementpcgci@phoenixcga.com', updated_at = NOW()
WHERE name = 'PHOENIX CONSULTING GROUP AFRICA' AND (contact_email IS NULL OR contact_email = '');

UPDATE organizations
SET contact_email = 'recrutement@prosuma.ci', updated_at = NOW()
WHERE name = 'PROSUMA' AND (contact_email IS NULL OR contact_email = '');

UPDATE organizations
SET contact_email = 'info@myagro.org', updated_at = NOW()
WHERE name = 'myAgro' AND (contact_email IS NULL OR contact_email = '');

UPDATE organizations
SET contact_email = 'info@theflex.global', updated_at = NOW()
WHERE name = 'The Flex' AND (contact_email IS NULL OR contact_email = '');

UPDATE organizations
SET contact_email = 'humanresources@mci.world', updated_at = NOW()
WHERE name = 'Mass Markets' AND (contact_email IS NULL OR contact_email = '');

COMMIT;
