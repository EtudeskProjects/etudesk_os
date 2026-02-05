-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Côte d'Ivoire
-- 3 Talents, 2 Organisations, 3 Opportunités par type (6 types = 18 total)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. TALENTS (3 nouveaux)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO talents (id, slug, first_name, last_name, email, phone, bio, city, region, country, remote_ready, willing_to_relocate, profile_tags, goals, sectors, gender)
VALUES
  (
    'a1b2c3d4-1111-4000-a000-000000000001',
    'aminata-kone',
    'Aminata', 'Koné',
    'aminata.kone@email.ci',
    '+22507010101',
    'Développeuse Full Stack avec 4 ans d''expérience en React, Node.js et PostgreSQL. Passionnée par les solutions tech pour l''Afrique.',
    'Abidjan', 'Lagunes', 'CI',
    true, false,
    ARRAY['JOB_SEEKER', 'SALARIED'],
    ARRAY['FIND_JOB', 'ADVANCE_CAREER', 'LEARN_NEW_SKILLS'],
    ARRAY['DIGITAL', 'FINANCE'],
    'female'
  ),
  (
    'a1b2c3d4-2222-4000-a000-000000000002',
    'moussa-diallo',
    'Moussa', 'Diallo',
    'moussa.diallo@email.ci',
    '+22507020202',
    'Étudiant en Master 2 Génie Civil à l''INP-HB Yamoussoukro. Recherche un stage de fin d''études en BTP ou infrastructure.',
    'Yamoussoukro', 'Lacs', 'CI',
    false, true,
    ARRAY['STUDENT'],
    ARRAY['FIND_JOB', 'LEARN_NEW_SKILLS', 'PREPARE_EXAMS'],
    ARRAY['CONSTRUCTION', 'INDUSTRY', 'ENVIRONMENT'],
    'male'
  ),
  (
    'a1b2c3d4-3333-4000-a000-000000000003',
    'fatou-traore',
    'Fatou', 'Traoré',
    'fatou.traore@email.ci',
    '+22507030303',
    'Consultante en marketing digital et communication. 6 ans d''expérience dans le conseil aux PME ivoiriennes et ouest-africaines.',
    'Abidjan', 'Lagunes', 'CI',
    true, false,
    ARRAY['CONSULTANT', 'ENTREPRENEUR'],
    ARRAY['ADVANCE_CAREER', 'TEACH_OR_MENTOR'],
    ARRAY['MEDIA', 'COMMERCE', 'DIGITAL'],
    'female'
  );

-- Users correspondants
INSERT INTO users (id, email, talent_id, email_verified, is_active)
VALUES
  (uuid_generate_v4(), 'aminata.kone@email.ci',  'a1b2c3d4-1111-4000-a000-000000000001', true, true),
  (uuid_generate_v4(), 'moussa.diallo@email.ci',  'a1b2c3d4-2222-4000-a000-000000000002', true, true),
  (uuid_generate_v4(), 'fatou.traore@email.ci',   'a1b2c3d4-3333-4000-a000-000000000003', true, true);

-- ═══════════════════════════════════════════════════════════════
-- 2. COMPÉTENCES DES TALENTS
-- ═══════════════════════════════════════════════════════════════

-- Aminata (Dev Full Stack)
INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin) VALUES
  ('a1b2c3d4-1111-4000-a000-000000000001', 'React',       'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-1111-4000-a000-000000000001', 'Node.js',     'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-1111-4000-a000-000000000001', 'PostgreSQL',  'HARD_SKILL', 'INTERMEDIATE',  'declared'),
  ('a1b2c3d4-1111-4000-a000-000000000001', 'TypeScript',  'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-1111-4000-a000-000000000001', 'Git',         'HARD_SKILL', 'INTERMEDIATE',  'declared'),
  ('a1b2c3d4-1111-4000-a000-000000000001', 'Travail d''équipe', 'SOFT_SKILL', 'EXPERT',   'declared');

-- Moussa (Génie Civil)
INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin) VALUES
  ('a1b2c3d4-2222-4000-a000-000000000002', 'AutoCAD',       'HARD_SKILL', 'INTERMEDIATE', 'declared'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'Revit',         'HARD_SKILL', 'BEGINNER',     'declared'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'Calcul béton armé', 'KNOWLEDGE', 'INTERMEDIATE', 'declared'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'Gestion de chantier', 'HARD_SKILL', 'BEGINNER', 'declared'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'Rigueur',       'SOFT_SKILL', 'EXPERT',       'declared');

-- Fatou (Marketing Digital)
INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin) VALUES
  ('a1b2c3d4-3333-4000-a000-000000000003', 'Marketing Digital',   'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'SEO/SEM',             'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'Google Analytics',    'HARD_SKILL', 'INTERMEDIATE',  'declared'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'Community Management','HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'Leadership',          'SOFT_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'Communication',       'SOFT_SKILL', 'EXPERT',        'declared');

-- ═══════════════════════════════════════════════════════════════
-- 3. ORGANISATIONS (2)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, types, sectors, description, website_url, contact_email, contact_phone, headquarters_city, headquarters_region, headquarters_country, verification_status, created_by)
VALUES
  (
    'b1b2c3d4-1111-4000-b000-000000000001',
    'AfriTech Solutions',
    'afritech-solutions',
    ARRAY['COMPANY', 'STARTUP'],
    ARRAY['DIGITAL', 'FINANCE'],
    'AfriTech Solutions est une startup ivoirienne spécialisée dans le développement de solutions fintech et d''applications mobiles pour l''Afrique de l''Ouest. Nous accompagnons les entreprises dans leur transformation digitale.',
    'https://afritech-solutions.ci',
    'contact@afritech-solutions.ci',
    '+22527200101',
    'Abidjan', 'Lagunes', 'CI',
    'VERIFIED',
    'a1b2c3d4-1111-4000-a000-000000000001'
  ),
  (
    'b1b2c3d4-2222-4000-b000-000000000002',
    'BTP Côte d''Ivoire',
    'btp-cote-divoire',
    ARRAY['COMPANY'],
    ARRAY['CONSTRUCTION', 'INDUSTRY'],
    'BTP Côte d''Ivoire est un groupe de construction et d''infrastructure avec plus de 15 ans d''expérience. Présent sur les grands projets routiers, immobiliers et d''infrastructure publique en Côte d''Ivoire.',
    'https://btp-ci.com',
    'rh@btp-ci.com',
    '+22527200202',
    'Abidjan', 'Lagunes', 'CI',
    'VERIFIED',
    'a1b2c3d4-3333-4000-a000-000000000003'
  );

-- Membres des organisations
INSERT INTO organization_members (organization_id, talent_id, role, status, joined_at) VALUES
  ('b1b2c3d4-1111-4000-b000-000000000001', 'a1b2c3d4-1111-4000-a000-000000000001', 'ADMIN',  'ACTIVE', NOW()),
  ('b1b2c3d4-1111-4000-b000-000000000001', 'a1b2c3d4-3333-4000-a000-000000000003', 'MEMBER', 'ACTIVE', NOW()),
  ('b1b2c3d4-2222-4000-b000-000000000002', 'a1b2c3d4-3333-4000-a000-000000000003', 'ADMIN',  'ACTIVE', NOW()),
  ('b1b2c3d4-2222-4000-b000-000000000002', 'a1b2c3d4-2222-4000-a000-000000000002', 'MEMBER', 'ACTIVE', NOW());

-- ═══════════════════════════════════════════════════════════════
-- 4. OPPORTUNITÉS — 3 par type (6 types × 3 = 18 offres)
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────
-- TYPE: EMPLOYMENT (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, compensation_min, compensation_max, currency, compensation_frequency, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000001-0001-4000-c000-000000000001',
    'Développeur Full Stack Senior',
    'dev-fullstack-senior-afritech',
    'EMPLOYMENT', 'CDI', 'FULL_TIME',
    'Rejoignez notre équipe tech pour développer des applications fintech innovantes. Vous serez responsable de l''architecture et du développement de nos produits SaaS.',
    'Minimum 3 ans d''expérience en React + Node.js. Maîtrise de PostgreSQL et des APIs REST. Connaissance de TypeScript requise.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'FINANCE'],
    800000, 1500000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Cocody, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '60 days'
  ),
  (
    'c0000001-0002-4000-c000-000000000002',
    'Responsable Marketing Digital',
    'resp-marketing-digital-afritech',
    'EMPLOYMENT', 'CDI', 'FULL_TIME',
    'Nous recherchons un(e) responsable marketing digital pour piloter notre stratégie d''acquisition et de fidélisation client en Afrique de l''Ouest.',
    'Minimum 4 ans en marketing digital. Maîtrise de Google Ads, Facebook Ads et outils analytics. Expérience en fintech ou startup tech appréciée.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'MEDIA'],
    600000, 1000000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Plateau, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '45 days'
  ),
  (
    'c0000001-0003-4000-c000-000000000003',
    'Chef de Projet BTP',
    'chef-projet-btp-ci',
    'EMPLOYMENT', 'CDI', 'FULL_TIME',
    'Pilotez nos projets de construction d''envergure : routes, ponts, bâtiments. Coordination des équipes terrain et suivi budgétaire.',
    'Diplôme ingénieur Génie Civil. 5 ans d''expérience minimum en gestion de chantier. Maîtrise d''AutoCAD et MS Project.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION', 'INDUSTRY'],
    1000000, 2000000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Yopougon, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  );

-- ────────────────────────────────────────
-- TYPE: INTERNSHIP (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, compensation_min, compensation_max, currency, compensation_frequency, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000002-0001-4000-c000-000000000001',
    'Stage Développement Mobile (React Native)',
    'stage-dev-mobile-afritech',
    'INTERNSHIP', 'INTERNSHIP', 'FULL_TIME',
    'Stage de 6 mois pour participer au développement de notre application mobile fintech. Encadrement par des développeurs seniors.',
    'Étudiant(e) en informatique, Bac+3 minimum. Connaissances en JavaScript/React appréciées. Motivation et curiosité technique.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL'],
    150000, 200000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Cocody, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000002-0002-4000-c000-000000000002',
    'Stage Ingénieur Génie Civil',
    'stage-ingenieur-gc-btp',
    'INTERNSHIP', 'INTERNSHIP', 'FULL_TIME',
    'Stage de fin d''études de 4 à 6 mois sur nos chantiers de construction routière. Participation au suivi technique et au contrôle qualité.',
    'Étudiant(e) en Génie Civil, Bac+4/5. Bases en calcul de structures et lecture de plans. Disponibilité immédiate.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION'],
    100000, 150000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Yamoussoukro","country":"CI","label":"Yamoussoukro"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '21 days'
  ),
  (
    'c0000002-0003-4000-c000-000000000003',
    'Stage Communication & Community Management',
    'stage-community-manager-afritech',
    'INTERNSHIP', 'INTERNSHIP', 'FULL_TIME',
    'Rejoignez l''équipe communication pour gérer nos réseaux sociaux, créer du contenu et animer notre communauté de clients.',
    'Étudiant(e) en communication ou marketing digital. Maîtrise des réseaux sociaux et outils de design (Canva, Figma). Bonne rédaction.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['MEDIA', 'DIGITAL'],
    100000, 150000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Marcory, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '15 days'
  );

-- ────────────────────────────────────────
-- TYPE: FREELANCE (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, compensation_min, compensation_max, currency, compensation_frequency, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000003-0001-4000-c000-000000000001',
    'Développeur Backend API (Mission Freelance)',
    'freelance-dev-backend-afritech',
    'FREELANCE', 'FREELANCE', 'FLEXIBLE',
    'Mission de 3 mois pour développer et intégrer des APIs de paiement mobile (Orange Money, MTN MoMo, Wave). Travail 100% remote possible.',
    'Expérience en Node.js/Express ou Python/FastAPI. Connaissance des APIs de paiement mobile en Afrique. Disponibilité de 20h/semaine minimum.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'FINANCE'],
    500000, 800000, 'XOF', 'MONTHLY',
    'REMOTE',
    '[{"city":"Abidjan","country":"CI","label":"Remote - Côte d''Ivoire"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000003-0002-4000-c000-000000000002',
    'Designer UI/UX Freelance',
    'freelance-designer-uiux-afritech',
    'FREELANCE', 'FREELANCE', 'FLEXIBLE',
    'Refonte de l''interface utilisateur de notre application mobile. Création de maquettes, prototypes interactifs et design system.',
    'Portfolio solide en design mobile. Maîtrise de Figma. Compréhension des principes d''accessibilité. 2 ans d''expérience minimum.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL'],
    400000, 700000, 'XOF', 'MONTHLY',
    'REMOTE',
    '[{"city":"Abidjan","country":"CI","label":"Remote - Côte d''Ivoire"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '21 days'
  ),
  (
    'c0000003-0003-4000-c000-000000000003',
    'Géomètre Topographe (Mission Terrain)',
    'freelance-geometre-btp',
    'FREELANCE', 'SERVICE', 'OCCASIONAL',
    'Mission de relevé topographique pour un projet routier de 12 km dans la région de San-Pédro. Durée estimée : 2 semaines.',
    'Diplôme en topographie ou géomètre expert. Matériel GPS/Station totale disponible. Expérience en travaux routiers.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION'],
    1500000, 2500000, 'XOF', 'PROJECT',
    'ON_SITE',
    '[{"city":"San-Pédro","country":"CI","label":"San-Pédro, Bas-Sassandra"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '14 days'
  );

-- ────────────────────────────────────────
-- TYPE: ENTREPRENEURSHIP (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000004-0001-4000-c000-000000000001',
    'Co-fondateur Technique (CTO) - Startup AgriTech',
    'cofondateur-cto-agritech',
    'ENTREPRENEURSHIP', 'FREELANCE', 'FULL_TIME',
    'Nous lançons une plateforme de mise en relation entre agriculteurs et acheteurs en Côte d''Ivoire. Recherche d''un CTO pour co-fonder et développer la solution technique.',
    'Développeur expérimenté (3+ ans). Appétit entrepreneurial. Prêt à travailler en equity les 6 premiers mois. Connaissance du secteur agricole est un plus.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'AGRICULTURE'],
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '90 days'
  ),
  (
    'c0000004-0002-4000-c000-000000000002',
    'Associé(e) Commercial(e) - Distribution Matériaux BTP',
    'associe-commercial-materiaux-btp',
    'ENTREPRENEURSHIP', 'SERVICE', 'FULL_TIME',
    'Recherche d''un(e) associé(e) pour développer un réseau de distribution de matériaux de construction dans les villes secondaires de Côte d''Ivoire.',
    'Expérience commerciale dans le BTP. Réseau dans le secteur de la construction. Apport en capital ou en nature possible.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION', 'COMMERCE'],
    'ON_SITE',
    '[{"city":"Bouaké","country":"CI","label":"Bouaké, Vallée du Bandama"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '60 days'
  ),
  (
    'c0000004-0003-4000-c000-000000000003',
    'Partenaire Agence de Marketing Digital',
    'partenaire-agence-marketing-digital',
    'ENTREPRENEURSHIP', 'SERVICE', 'FLEXIBLE',
    'Création d''une agence de marketing digital spécialisée PME ivoiriennes. Recherche d''un(e) partenaire avec expertise en acquisition digitale.',
    'Expert en marketing digital (SEO, SEA, Social Ads). Portefeuille client existant est un plus. Vision entrepreneuriale.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['MEDIA', 'DIGITAL', 'COMMERCE'],
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '45 days'
  );

-- ────────────────────────────────────────
-- TYPE: ALTERNATION (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, compensation_min, compensation_max, currency, compensation_frequency, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000005-0001-4000-c000-000000000001',
    'Alternance Data Analyst',
    'alternance-data-analyst-afritech',
    'ALTERNATION', 'APPRENTICESHIP', 'PART_TIME',
    'Alternance de 12 mois : 3 jours en entreprise, 2 jours en formation. Analyse de données clients, création de dashboards et rapports BI.',
    'Étudiant(e) en data science, statistiques ou informatique. Connaissances en Python/SQL. Formation en cours (Master 1 ou 2).',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'FINANCE'],
    250000, 350000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Cocody, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000005-0002-4000-c000-000000000002',
    'Alternance Conducteur de Travaux Junior',
    'alternance-conducteur-travaux-btp',
    'ALTERNATION', 'APPRENTICESHIP', 'PART_TIME',
    'Programme d''alternance de 18 mois sur nos chantiers de bâtiment. Formation terrain en conduite de travaux et gestion de sous-traitants.',
    'Étudiant(e) en BTS ou DUT Génie Civil. Motivation pour le terrain. Permis B souhaité.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION'],
    200000, 300000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Abobo, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '45 days'
  ),
  (
    'c0000005-0003-4000-c000-000000000003',
    'Alternance Comptabilité & Gestion',
    'alternance-comptabilite-gestion-btp',
    'ALTERNATION', 'APPRENTICESHIP', 'PART_TIME',
    'Alternance au service comptable : suivi facturation chantiers, rapprochement bancaire, préparation bilan. Encadrement par un expert-comptable.',
    'Étudiant(e) en BTS Comptabilité ou DCG. Maîtrise d''Excel. Rigueur et organisation.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['FINANCE', 'CONSTRUCTION'],
    200000, 280000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Plateau, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  );

-- ────────────────────────────────────────
-- TYPE: VOLUNTEER (3 offres)
-- ────────────────────────────────────────

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000006-0001-4000-c000-000000000001',
    'Mentor Tech pour Jeunes Développeurs',
    'benevole-mentor-tech-afritech',
    'VOLUNTEER', 'SERVICE', 'OCCASIONAL',
    'Encadrez de jeunes développeurs ivoiriens pendant notre programme bootcamp de 3 mois. 4h par semaine de mentorat en ligne ou présentiel.',
    'Développeur avec 2+ ans d''expérience. Pédagogue et patient. Envie de transmettre.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'EDUCATION'],
    'HYBRID',
    '[{"city":"Abidjan","country":"CI","label":"Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '60 days'
  ),
  (
    'c0000006-0002-4000-c000-000000000002',
    'Bénévole Construction École Rurale',
    'benevole-construction-ecole-rurale',
    'VOLUNTEER', 'SERVICE', 'FULL_TIME',
    'Participez à la construction d''une école primaire dans le village de Bondoukou. Chantier solidaire de 2 semaines, hébergement et repas fournis.',
    'Compétences en maçonnerie, plomberie ou électricité appréciées. Bonne condition physique. Aucun diplôme requis.',
    'b1b2c3d4-2222-4000-b000-000000000002',
    ARRAY['CONSTRUCTION', 'SOCIAL_IMPACT', 'EDUCATION'],
    'ON_SITE',
    '[{"city":"Bondoukou","country":"CI","label":"Bondoukou, Gontougo"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000006-0003-4000-c000-000000000003',
    'Formatrice/Formateur en Littératie Numérique',
    'benevole-litteratie-numerique',
    'VOLUNTEER', 'SERVICE', 'OCCASIONAL',
    'Animez des ateliers d''initiation à l''informatique et à Internet pour des femmes entrepreneures dans les marchés d''Abidjan. 2 sessions de 2h par semaine.',
    'Patience et pédagogie. Maîtrise basique de l''informatique et des outils numériques. Français courant, malinké ou baoulé apprécié.',
    'b1b2c3d4-1111-4000-b000-000000000001',
    ARRAY['DIGITAL', 'SOCIAL_IMPACT', 'EDUCATION'],
    'ON_SITE',
    '[{"city":"Abidjan","country":"CI","label":"Adjamé, Abidjan"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '45 days'
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. DOCUMENTS pour Aminata (pour tester file-read)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO talent_documents (id, talent_id, original_filename, stored_filename, mime_type, file_size, file_url, document_type, category, status, title, description)
VALUES
  (
    'd0000001-0001-4000-d000-000000000001',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'CV_Aminata_Kone_2026.pdf',
    'cv-aminata-kone-2026.pdf',
    'application/pdf',
    245000,
    '/uploads/documents/cv-aminata-kone-2026.pdf',
    'CV', 'PROFESSIONAL', 'PROCESSED',
    'CV Aminata Koné - Développeuse Full Stack',
    'CV professionnel détaillant 4 ans d''expérience en développement web avec React, Node.js, PostgreSQL et TypeScript.'
  ),
  (
    'd0000001-0002-4000-d000-000000000002',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'Diplome_Licence_Informatique.pdf',
    'diplome-licence-info.pdf',
    'application/pdf',
    180000,
    '/uploads/documents/diplome-licence-info.pdf',
    'DIPLOMA', 'ACADEMIC', 'VERIFIED',
    'Licence en Informatique - Université FHB',
    'Licence en Informatique obtenue à l''Université Félix Houphouët-Boigny d''Abidjan en 2021.'
  );

-- ═══════════════════════════════════════════════════════════════
-- 6. SÉNÉGAL — Talents & Organisations
-- ═══════════════════════════════════════════════════════════════

INSERT INTO talents (id, slug, first_name, last_name, email, phone, bio, city, region, country, remote_ready, willing_to_relocate, profile_tags, goals, sectors, gender)
VALUES
  (
    'a1b2c3d4-4444-4000-a000-000000000004',
    'ibrahima-ndiaye',
    'Ibrahima', 'Ndiaye',
    'ibrahima.ndiaye@email.sn',
    '+221770101010',
    'Ingénieur logiciel senior spécialisé en cloud computing et DevOps. 6 ans d''expérience chez des startups tech à Dakar. Contributeur open source.',
    'Dakar', 'Dakar', 'SN',
    true, false,
    ARRAY['SALARIED', 'CONSULTANT'],
    ARRAY['ADVANCE_CAREER', 'TEACH_OR_MENTOR', 'LEARN_NEW_SKILLS'],
    ARRAY['DIGITAL', 'TELECOM'],
    'male'
  ),
  (
    'a1b2c3d4-5555-4000-a000-000000000005',
    'aissatou-diop',
    'Aissatou', 'Diop',
    'aissatou.diop@email.sn',
    '+221770202020',
    'Architecte urbaniste et consultante en développement durable. Spécialisée dans les bâtiments écologiques et l''aménagement urbain en Afrique de l''Ouest.',
    'Dakar', 'Dakar', 'SN',
    true, true,
    ARRAY['CONSULTANT', 'ENTREPRENEUR'],
    ARRAY['FIND_JOB', 'ADVANCE_CAREER'],
    ARRAY['CONSTRUCTION', 'ENVIRONMENT', 'ENERGY'],
    'female'
  );

INSERT INTO users (id, email, talent_id, email_verified, is_active)
VALUES
  (uuid_generate_v4(), 'ibrahima.ndiaye@email.sn', 'a1b2c3d4-4444-4000-a000-000000000004', true, true),
  (uuid_generate_v4(), 'aissatou.diop@email.sn',   'a1b2c3d4-5555-4000-a000-000000000005', true, true);

-- Compétences Sénégal
INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin) VALUES
  ('a1b2c3d4-4444-4000-a000-000000000004', 'AWS',          'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-4444-4000-a000-000000000004', 'Docker',       'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-4444-4000-a000-000000000004', 'Kubernetes',   'HARD_SKILL', 'INTERMEDIATE',  'declared'),
  ('a1b2c3d4-4444-4000-a000-000000000004', 'Python',       'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-4444-4000-a000-000000000004', 'CI/CD',        'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-4444-4000-a000-000000000004', 'Mentorat',     'SOFT_SKILL', 'INTERMEDIATE',  'declared');

INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin) VALUES
  ('a1b2c3d4-5555-4000-a000-000000000005', 'AutoCAD',               'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-5555-4000-a000-000000000005', 'ArchiCAD',              'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-5555-4000-a000-000000000005', 'Urbanisme durable',     'KNOWLEDGE',  'EXPERT',        'declared'),
  ('a1b2c3d4-5555-4000-a000-000000000005', 'Certification HQE',     'KNOWLEDGE',  'INTERMEDIATE',  'declared'),
  ('a1b2c3d4-5555-4000-a000-000000000005', 'Gestion de projet',     'HARD_SKILL', 'EXPERT',        'declared'),
  ('a1b2c3d4-5555-4000-a000-000000000005', 'Communication',         'SOFT_SKILL', 'EXPERT',        'declared');

-- Organisations Sénégal
INSERT INTO organizations (id, name, slug, types, sectors, description, website_url, contact_email, contact_phone, headquarters_city, headquarters_region, headquarters_country, verification_status, created_by)
VALUES
  (
    'b1b2c3d4-3333-4000-b000-000000000003',
    'Dakar Digital Hub',
    'dakar-digital-hub',
    ARRAY['COMPANY', 'STARTUP'],
    ARRAY['DIGITAL', 'TELECOM'],
    'Dakar Digital Hub est un incubateur et accélérateur tech au cœur de Dakar. Nous accompagnons les startups sénégalaises et ouest-africaines dans leur croissance grâce au mentorat, au financement et à un réseau d''experts.',
    'https://dakardigitalhub.sn',
    'contact@dakardigitalhub.sn',
    '+221338001010',
    'Dakar', 'Dakar', 'SN',
    'VERIFIED',
    'a1b2c3d4-4444-4000-a000-000000000004'
  ),
  (
    'b1b2c3d4-4444-4000-b000-000000000004',
    'Sénégal Énergie Verte',
    'senegal-energie-verte',
    ARRAY['COMPANY', 'NGO'],
    ARRAY['ENERGY', 'ENVIRONMENT', 'CONSTRUCTION'],
    'Sénégal Énergie Verte est une entreprise sociale spécialisée dans les solutions d''énergie solaire et la construction durable. Nous installons des panneaux solaires et concevons des bâtiments écologiques pour les communautés rurales et urbaines.',
    'https://senegal-energie-verte.sn',
    'info@senegal-energie-verte.sn',
    '+221338002020',
    'Dakar', 'Dakar', 'SN',
    'VERIFIED',
    'a1b2c3d4-5555-4000-a000-000000000005'
  );

INSERT INTO organization_members (organization_id, talent_id, role, status, joined_at) VALUES
  ('b1b2c3d4-3333-4000-b000-000000000003', 'a1b2c3d4-4444-4000-a000-000000000004', 'ADMIN',  'ACTIVE', NOW()),
  ('b1b2c3d4-3333-4000-b000-000000000003', 'a1b2c3d4-1111-4000-a000-000000000001', 'MEMBER', 'ACTIVE', NOW()),
  ('b1b2c3d4-4444-4000-b000-000000000004', 'a1b2c3d4-5555-4000-a000-000000000005', 'ADMIN',  'ACTIVE', NOW()),
  ('b1b2c3d4-4444-4000-b000-000000000004', 'a1b2c3d4-2222-4000-a000-000000000002', 'MEMBER', 'ACTIVE', NOW());

-- ═══════════════════════════════════════════════════════════════
-- 7. COMMUNAUTÉS — 4 Côte d'Ivoire + 4 Sénégal
-- ═══════════════════════════════════════════════════════════════

INSERT INTO communities (id, name, slug, type, description, access_type, visibility, tags, sectors, city, region, country, coordinates, is_paid, monthly_price, currency, status, created_by, organization_id)
VALUES
  -- ── Côte d'Ivoire ──
  (
    'e0000001-0001-4000-e000-000000000001',
    'Tech Abidjan',
    'tech-abidjan',
    'ONLINE',
    'La plus grande communauté tech d''Abidjan. Échangez sur le développement web, mobile, data science, IA et cloud. Événements mensuels, partage d''offres d''emploi, entraide technique et networking entre développeurs, designers et product managers ivoiriens.',
    'PUBLIC', 'PUBLIC',
    '["tech", "développement", "startup", "web", "mobile", "IA"]'::jsonb,
    '["DIGITAL"]'::jsonb,
    'Abidjan', 'Lagunes', 'CI',
    POINT(-3.9823, 5.3544),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'b1b2c3d4-1111-4000-b000-000000000001'
  ),
  (
    'e0000001-0002-4000-e000-000000000002',
    'BTP & Construction Côte d''Ivoire',
    'btp-construction-ci',
    'HYBRID',
    'Communauté des professionnels du BTP et de la construction en Côte d''Ivoire. Ingénieurs, architectes, conducteurs de travaux, géomètres : partagez vos expériences terrain, discutez normes et réglementations, et trouvez des collaborateurs pour vos projets.',
    'PUBLIC', 'PUBLIC',
    '["BTP", "construction", "génie civil", "architecture", "infrastructure"]'::jsonb,
    '["CONSTRUCTION", "INDUSTRY"]'::jsonb,
    'Abidjan', 'Lagunes', 'CI',
    POINT(-4.0164, 5.3203),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-2222-4000-a000-000000000002',
    'b1b2c3d4-2222-4000-b000-000000000002'
  ),
  (
    'e0000001-0003-4000-e000-000000000003',
    'Femmes Entrepreneures de Côte d''Ivoire',
    'femmes-entrepreneures-ci',
    'ONLINE',
    'Réseau d''entraide pour les femmes entrepreneures ivoiriennes. Mentorat, financement, formation en gestion, marketing digital et leadership. Objectif : soutenir 1000 femmes dans la création et le développement de leur entreprise.',
    'PUBLIC', 'PUBLIC',
    '["entrepreneuriat", "femmes", "leadership", "mentorat", "PME"]'::jsonb,
    '["COMMERCE", "DIGITAL", "SOCIAL_IMPACT"]'::jsonb,
    'Abidjan', 'Lagunes', 'CI',
    POINT(-3.9891, 5.3051),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-3333-4000-a000-000000000003',
    'b1b2c3d4-1111-4000-b000-000000000001'
  ),
  (
    'e0000001-0004-4000-e000-000000000004',
    'AgriTech Côte d''Ivoire',
    'agritech-ci',
    'HYBRID',
    'Communauté dédiée à l''innovation agricole en Côte d''Ivoire. AgriTech, agriculture de précision, chaînes d''approvisionnement, transformation locale. Réunit agriculteurs, ingénieurs agronomes et entrepreneurs tech autour de solutions pour moderniser l''agriculture ivoirienne.',
    'PUBLIC', 'PUBLIC',
    '["agriculture", "agritech", "innovation", "cacao", "transformation"]'::jsonb,
    '["AGRICULTURE", "DIGITAL", "ENVIRONMENT"]'::jsonb,
    'Yamoussoukro', 'Lacs', 'CI',
    POINT(-5.2893, 6.8276),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'b1b2c3d4-1111-4000-b000-000000000001'
  ),
  -- ── Sénégal ──
  (
    'e0000001-0005-4000-e000-000000000005',
    'Dakar Startup Community',
    'dakar-startup-community',
    'HYBRID',
    'L''écosystème startup de Dakar au complet. Fondateurs, investisseurs, mentors et talents se retrouvent pour pitcher, réseauter et co-construire les futures licornes africaines. Événements hebdomadaires aux Almadies, démos mensuelles et connexions avec les VCs de la sous-région.',
    'PUBLIC', 'PUBLIC',
    '["startup", "investissement", "pitch", "incubation", "venture capital"]'::jsonb,
    '["DIGITAL", "FINANCE", "COMMERCE"]'::jsonb,
    'Dakar', 'Dakar', 'SN',
    POINT(-17.5138, 14.7445),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-4444-4000-a000-000000000004',
    'b1b2c3d4-3333-4000-b000-000000000003'
  ),
  (
    'e0000001-0006-4000-e000-000000000006',
    'Développeurs Sénégal',
    'developpeurs-senegal',
    'ONLINE',
    'La communauté des développeurs sénégalais. Partagez du code, des tutoriels, des retours d''expérience sur les technos web, mobile, data et IA. Canal Slack actif avec plus de 500 membres. Hackathons trimestriels et coding dojos mensuels.',
    'PUBLIC', 'PUBLIC',
    '["développement", "code", "hackathon", "open source", "formation"]'::jsonb,
    '["DIGITAL"]'::jsonb,
    'Dakar', 'Dakar', 'SN',
    POINT(-17.4441, 14.6937),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-4444-4000-a000-000000000004',
    'b1b2c3d4-3333-4000-b000-000000000003'
  ),
  (
    'e0000001-0007-4000-e000-000000000007',
    'Énergie & Environnement Sénégal',
    'energie-environnement-senegal',
    'HYBRID',
    'Professionnels de l''énergie renouvelable et de l''environnement au Sénégal. Solaire, éolien, biomasse, gestion des déchets, construction durable. Échanges sur les projets en cours, les financements disponibles et les partenariats public-privé.',
    'PUBLIC', 'PUBLIC',
    '["énergie solaire", "environnement", "développement durable", "construction verte"]'::jsonb,
    '["ENERGY", "ENVIRONMENT", "CONSTRUCTION"]'::jsonb,
    'Dakar', 'Dakar', 'SN',
    POINT(-17.4753, 14.7058),
    true, 5000, 'XOF',
    'ACTIVE',
    'a1b2c3d4-5555-4000-a000-000000000005',
    'b1b2c3d4-4444-4000-b000-000000000004'
  ),
  (
    'e0000001-0008-4000-e000-000000000008',
    'Marketing Digital Afrique de l''Ouest',
    'marketing-digital-afrique-ouest',
    'ONLINE',
    'Communauté panafricaine de marketeurs digitaux basée entre Dakar et Abidjan. SEO, SEA, social media, content marketing, growth hacking. Études de cas, formations gratuites et offres de missions freelance partagées chaque semaine.',
    'PUBLIC', 'PUBLIC',
    '["marketing digital", "SEO", "social media", "growth", "freelance"]'::jsonb,
    '["MEDIA", "DIGITAL", "COMMERCE"]'::jsonb,
    'Dakar', 'Dakar', 'SN',
    POINT(-17.4441, 14.6937),
    false, NULL, 'XOF',
    'ACTIVE',
    'a1b2c3d4-3333-4000-a000-000000000003',
    'b1b2c3d4-3333-4000-b000-000000000003'
  );

-- Membres des communautés
INSERT INTO community_members (community_id, talent_id, role, status, joined_at) VALUES
  -- Tech Abidjan
  ('e0000001-0001-4000-e000-000000000001', 'a1b2c3d4-1111-4000-a000-000000000001', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0001-4000-e000-000000000001', 'a1b2c3d4-4444-4000-a000-000000000004', 'MEMBER', 'ACTIVE', NOW()),
  ('e0000001-0001-4000-e000-000000000001', 'a1b2c3d4-3333-4000-a000-000000000003', 'MEMBER', 'ACTIVE', NOW()),
  -- BTP CI
  ('e0000001-0002-4000-e000-000000000002', 'a1b2c3d4-2222-4000-a000-000000000002', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0002-4000-e000-000000000002', 'a1b2c3d4-5555-4000-a000-000000000005', 'MEMBER', 'ACTIVE', NOW()),
  -- Femmes Entrepreneures CI
  ('e0000001-0003-4000-e000-000000000003', 'a1b2c3d4-3333-4000-a000-000000000003', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0003-4000-e000-000000000003', 'a1b2c3d4-1111-4000-a000-000000000001', 'MEMBER', 'ACTIVE', NOW()),
  -- AgriTech CI
  ('e0000001-0004-4000-e000-000000000004', 'a1b2c3d4-1111-4000-a000-000000000001', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0004-4000-e000-000000000004', 'a1b2c3d4-2222-4000-a000-000000000002', 'MEMBER', 'ACTIVE', NOW()),
  -- Dakar Startup Community
  ('e0000001-0005-4000-e000-000000000005', 'a1b2c3d4-4444-4000-a000-000000000004', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0005-4000-e000-000000000005', 'a1b2c3d4-5555-4000-a000-000000000005', 'MEMBER', 'ACTIVE', NOW()),
  ('e0000001-0005-4000-e000-000000000005', 'a1b2c3d4-1111-4000-a000-000000000001', 'MEMBER', 'ACTIVE', NOW()),
  -- Développeurs Sénégal
  ('e0000001-0006-4000-e000-000000000006', 'a1b2c3d4-4444-4000-a000-000000000004', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0006-4000-e000-000000000006', 'a1b2c3d4-1111-4000-a000-000000000001', 'MEMBER', 'ACTIVE', NOW()),
  -- Énergie & Environnement SN
  ('e0000001-0007-4000-e000-000000000007', 'a1b2c3d4-5555-4000-a000-000000000005', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0007-4000-e000-000000000007', 'a1b2c3d4-2222-4000-a000-000000000002', 'MEMBER', 'ACTIVE', NOW()),
  -- Marketing Digital AO
  ('e0000001-0008-4000-e000-000000000008', 'a1b2c3d4-3333-4000-a000-000000000003', 'ADMIN',  'ACTIVE', NOW()),
  ('e0000001-0008-4000-e000-000000000008', 'a1b2c3d4-5555-4000-a000-000000000005', 'MEMBER', 'ACTIVE', NOW());

-- ═══════════════════════════════════════════════════════════════
-- 8. ESPACES — 4 Côte d'Ivoire + 4 Sénégal (coordonnées réelles)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO spaces (id, name, slug, description, type, surface_m2, capacity, floor_number, address, city, region, country, coordinates, equipment, amenities, sectors, is_accessible, hourly_rate, daily_rate, weekly_rate, monthly_rate, is_bookable, visibility, contact_name, contact_phone, contact_email, organization_id, created_by, status)
VALUES
  -- ── Côte d'Ivoire ──
  (
    'f0000001-0001-4000-f000-000000000001',
    'AfriTech Coworking Cocody',
    'afritech-coworking-cocody',
    'Espace de coworking moderne au cœur de Cocody, Riviera Bonoumin. Fibre optique 100 Mbps, bureaux flexibles, salles de réunion vitrées, espace détente avec café. Idéal pour développeurs, designers et entrepreneurs tech. Accès 7j/7, communauté dynamique de 80+ membres.',
    'COWORKING',
    250.00, 40, 2,
    'Riviera Bonoumin, Rue des Jardins, Immeuble Le Palmier, 2ème étage',
    'Abidjan', 'Lagunes', 'CI',
    POINT(-3.9823, 5.3544),
    ARRAY['Fibre optique 100 Mbps', 'Écrans 27 pouces', 'Webcams HD', 'Tableaux blancs', 'Imprimante laser'],
    ARRAY['Café & thé gratuits', 'Climatisation', 'Cuisine équipée', 'Terrasse', 'Parking', 'Casiers sécurisés'],
    ARRAY['DIGITAL', 'FINANCE'],
    true,
    3000, 15000, 60000, 180000,
    true, 'PUBLIC',
    'Aminata Koné', '+22507010101', 'coworking@afritech-solutions.ci',
    'b1b2c3d4-1111-4000-b000-000000000001',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'ACTIVE'
  ),
  (
    'f0000001-0002-4000-f000-000000000002',
    'Salle de Conférence Le Plateau',
    'salle-conference-plateau-abj',
    'Grande salle de conférence climatisée au Plateau, quartier des affaires d''Abidjan. Capacité 80 personnes en configuration théâtre, 40 en U. Équipée d''un vidéoprojecteur 4K, système de sonorisation, micros sans fil et visioconférence. Idéale pour séminaires, formations et événements d''entreprise.',
    'CONFERENCE_ROOM',
    120.00, 80, 5,
    'Avenue Terrasson de Fougères, Immeuble CCIA, 5ème étage',
    'Abidjan', 'Lagunes', 'CI',
    POINT(-4.0164, 5.3203),
    ARRAY['Vidéoprojecteur 4K', 'Sonorisation', 'Micros sans fil', 'Visioconférence Zoom/Teams', 'Tableaux blancs', 'Paperboard'],
    ARRAY['Climatisation', 'Accueil', 'Service traiteur sur demande', 'Parking souterrain', 'Wifi haut débit'],
    ARRAY['COMMERCE', 'FINANCE'],
    true,
    25000, 150000, NULL, NULL,
    true, 'PUBLIC',
    'Service événementiel', '+22527200101', 'events@afritech-solutions.ci',
    'b1b2c3d4-1111-4000-b000-000000000001',
    'a1b2c3d4-1111-4000-a000-000000000001',
    'ACTIVE'
  ),
  (
    'f0000001-0003-4000-f000-000000000003',
    'Centre de Formation BTP Yopougon',
    'centre-formation-btp-yopougon',
    'Centre de formation pratique pour les métiers du BTP à Yopougon zone industrielle. Salle de cours théorique de 30 places + atelier pratique de 200m². Équipements de chantier pour exercices pratiques : stations totales, niveaux laser, matériel de coffrage. Parking poids lourds disponible.',
    'TRAINING_ROOM',
    350.00, 30, 0,
    'Zone Industrielle de Yopougon, Rue de l''Usine, Bâtiment B',
    'Abidjan', 'Lagunes', 'CI',
    POINT(-4.0750, 5.3594),
    ARRAY['Station totale', 'Niveau laser', 'Vidéoprojecteur', 'Matériel de coffrage', 'Outils de chantier', 'Ordinateurs AutoCAD'],
    ARRAY['Parking poids lourds', 'Vestiaires', 'Douches', 'Cantine', 'Climatisation salle de cours'],
    ARRAY['CONSTRUCTION', 'INDUSTRY'],
    false,
    15000, 80000, 350000, NULL,
    true, 'PUBLIC',
    'Direction Formation BTP CI', '+22527200202', 'formation@btp-ci.com',
    'b1b2c3d4-2222-4000-b000-000000000002',
    'a1b2c3d4-2222-4000-a000-000000000002',
    'ACTIVE'
  ),
  (
    'f0000001-0004-4000-f000-000000000004',
    'Bureau Privé Marcory Zone 4',
    'bureau-prive-marcory-zone4',
    'Bureau privé meublé et climatisé en Zone 4, Marcory. 25m² avec bureau directeur, table de réunion 4 personnes, rangements. Connexion fibre dédiée. Accès à l''espace commun (cuisine, salle de détente). Bail flexible à partir d''un mois. Quartier calme et sécurisé proche du Pont de Gaulle.',
    'PRIVATE_OFFICE',
    25.00, 4, 1,
    'Zone 4, Boulevard de Marseille, Résidence Les Acacias',
    'Abidjan', 'Lagunes', 'CI',
    POINT(-3.9891, 5.3051),
    ARRAY['Bureau directeur', 'Table réunion 4 places', 'Fibre dédiée', 'Imprimante', 'Téléphone fixe'],
    ARRAY['Climatisation', 'Cuisine commune', 'Salle de détente', 'Gardiennage 24/7', 'Wifi backup'],
    ARRAY['COMMERCE', 'DIGITAL'],
    true,
    5000, 25000, 100000, 350000,
    true, 'PUBLIC',
    'Fatou Traoré', '+22507030303', 'bureaux@afritech-solutions.ci',
    'b1b2c3d4-1111-4000-b000-000000000001',
    'a1b2c3d4-3333-4000-a000-000000000003',
    'ACTIVE'
  ),
  -- ── Sénégal ──
  (
    'f0000001-0005-4000-f000-000000000005',
    'Dakar Digital Hub - Coworking Almadies',
    'dakar-digital-hub-almadies',
    'Le plus grand espace de coworking de Dakar, situé aux Almadies face à l''océan. 500m² sur 2 niveaux, 60 postes de travail, 4 salles de réunion, 1 studio podcast, 1 espace événementiel. Communauté de 120+ startups et freelances. Fibre 200 Mbps, générateur de secours, accès 24/7.',
    'COWORKING',
    500.00, 60, 0,
    'Route des Almadies, en face de la Mosquée, Villa 42',
    'Dakar', 'Dakar', 'SN',
    POINT(-17.5138, 14.7445),
    ARRAY['Fibre 200 Mbps', 'Écrans externes', 'Studio podcast', 'Tableau interactif', 'Imprimante 3D', 'Scanner'],
    ARRAY['Café & thé bio', 'Climatisation', 'Terrasse vue mer', 'Parking', 'Espace détente', 'Douches', 'Générateur'],
    ARRAY['DIGITAL', 'TELECOM'],
    true,
    2500, 12000, 50000, 150000,
    true, 'PUBLIC',
    'Ibrahima Ndiaye', '+221770101010', 'coworking@dakardigitalhub.sn',
    'b1b2c3d4-3333-4000-b000-000000000003',
    'a1b2c3d4-4444-4000-a000-000000000004',
    'ACTIVE'
  ),
  (
    'f0000001-0006-4000-f000-000000000006',
    'Salle de Réunion Mermoz',
    'salle-reunion-mermoz-dakar',
    'Salle de réunion premium au quartier Mermoz-Sacré-Cœur, Dakar. 8 à 12 personnes. Mobilier design, écran 65 pouces, visioconférence HD, tableau blanc magnétique. Service café et restauration rapide. Parfaite pour réunions clients, workshops et brainstorming d''équipe.',
    'MEETING_ROOM',
    35.00, 12, 3,
    'Mermoz-Sacré-Cœur, Rue MZ-42, Immeuble Keur Gorgui',
    'Dakar', 'Dakar', 'SN',
    POINT(-17.4753, 14.7058),
    ARRAY['Écran 65 pouces', 'Visioconférence HD', 'Tableau blanc magnétique', 'Prises USB intégrées', 'Wifi dédié'],
    ARRAY['Climatisation', 'Service café', 'Restauration rapide', 'Parking', 'Accueil personnalisé'],
    ARRAY['DIGITAL', 'COMMERCE', 'FINANCE'],
    true,
    10000, 50000, NULL, NULL,
    true, 'PUBLIC',
    'Ibrahima Ndiaye', '+221770101010', 'salles@dakardigitalhub.sn',
    'b1b2c3d4-3333-4000-b000-000000000003',
    'a1b2c3d4-4444-4000-a000-000000000004',
    'ACTIVE'
  ),
  (
    'f0000001-0007-4000-f000-000000000007',
    'Espace Événementiel Diamniadio',
    'espace-evenementiel-diamniadio',
    'Grand espace événementiel dans la ville nouvelle de Diamniadio, à 40 min de Dakar. 400m² modulables : configuration conférence (200 places), formation (80 places), cocktail (300 debout). Scène avec éclairage professionnel, sonorisation et régie technique. Parking gratuit 100 places.',
    'EVENT_SPACE',
    400.00, 200, 0,
    'Pôle Urbain de Diamniadio, Boulevard de la République, Bâtiment C',
    'Diamniadio', 'Dakar', 'SN',
    POINT(-17.1827, 14.7115),
    ARRAY['Scène modulable', 'Éclairage professionnel', 'Sonorisation 500W', 'Régie technique', 'Vidéoprojecteur 4K', 'Micros HF'],
    ARRAY['Parking 100 places', 'Climatisation industrielle', 'Loges artistes', 'Service traiteur partenaire', 'Groupe électrogène'],
    ARRAY['MEDIA', 'EDUCATION', 'DIGITAL'],
    true,
    50000, 250000, NULL, NULL,
    true, 'PUBLIC',
    'Direction DDH Events', '+221338001010', 'events@dakardigitalhub.sn',
    'b1b2c3d4-3333-4000-b000-000000000003',
    'a1b2c3d4-4444-4000-a000-000000000004',
    'ACTIVE'
  ),
  (
    'f0000001-0008-4000-f000-000000000008',
    'Centre de Formation Énergie Solaire Thiès',
    'centre-formation-solaire-thies',
    'Centre de formation spécialisé dans l''installation et la maintenance de panneaux solaires à Thiès. Salle de cours 20 places + atelier pratique avec panneaux de démonstration, onduleurs et batteries. Formation certifiante en partenariat avec les fabricants. Hébergement possible pour les stagiaires venant de l''intérieur du pays.',
    'TRAINING_ROOM',
    200.00, 20, 0,
    'Route de Dakar, Zone Artisanale, Lot 15',
    'Thiès', 'Thiès', 'SN',
    POINT(-16.9260, 14.7886),
    ARRAY['Panneaux solaires démo', 'Onduleurs', 'Batteries lithium', 'Multimètres', 'Vidéoprojecteur', 'Kits d''installation'],
    ARRAY['Climatisation', 'Hébergement stagiaires', 'Cantine', 'Parking', 'Outillage fourni'],
    ARRAY['ENERGY', 'ENVIRONMENT', 'EDUCATION'],
    false,
    8000, 40000, 175000, NULL,
    true, 'PUBLIC',
    'Aissatou Diop', '+221770202020', 'formation@senegal-energie-verte.sn',
    'b1b2c3d4-4444-4000-b000-000000000004',
    'a1b2c3d4-5555-4000-a000-000000000005',
    'ACTIVE'
  );

-- ═══════════════════════════════════════════════════════════════
-- 9. OPPORTUNITÉS SÉNÉGAL — 6 (1 par type)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, compensation_min, compensation_max, currency, compensation_frequency, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000007-0001-4000-c000-000000000001',
    'Ingénieur DevOps / Cloud',
    'ingenieur-devops-cloud-dakar',
    'EMPLOYMENT', 'CDI', 'FULL_TIME',
    'Rejoignez l''équipe infrastructure de Dakar Digital Hub. Vous gérerez notre plateforme cloud (AWS/GCP), mettrez en place les pipelines CI/CD et assurerez la scalabilité de nos services pour les startups incubées.',
    'Minimum 3 ans d''expérience en DevOps. Maîtrise d''AWS ou GCP, Docker, Kubernetes. Expérience en CI/CD (GitHub Actions, GitLab CI). Linux avancé.',
    'b1b2c3d4-3333-4000-b000-000000000003',
    ARRAY['DIGITAL', 'TELECOM'],
    800000, 1400000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"Dakar","country":"SN","label":"Almadies, Dakar"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '45 days'
  ),
  (
    'c0000007-0002-4000-c000-000000000002',
    'Stage Développement Web Full Stack',
    'stage-dev-web-fullstack-dakar',
    'INTERNSHIP', 'INTERNSHIP', 'FULL_TIME',
    'Stage de 6 mois au sein de notre équipe produit. Développement d''applications web avec React, Node.js et PostgreSQL pour les startups de notre portfolio.',
    'Étudiant(e) en informatique Bac+3/4. Connaissances en JavaScript, HTML/CSS. Motivation et envie d''apprendre. Portfolio ou projets personnels appréciés.',
    'b1b2c3d4-3333-4000-b000-000000000003',
    ARRAY['DIGITAL'],
    150000, 200000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"Dakar","country":"SN","label":"Almadies, Dakar"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000007-0003-4000-c000-000000000003',
    'Consultant Énergie Solaire (Mission Freelance)',
    'freelance-consultant-solaire-sn',
    'FREELANCE', 'FREELANCE', 'FLEXIBLE',
    'Mission de 4 mois pour dimensionner et superviser l''installation de centrales solaires photovoltaïques dans 5 villages de la région de Kédougou. Budget total : 50M XOF.',
    'Ingénieur en énergie renouvelable avec 3+ ans d''expérience en solaire PV. Connaissance du marché sénégalais. Disponibilité pour déplacements terrain.',
    'b1b2c3d4-4444-4000-b000-000000000004',
    ARRAY['ENERGY', 'ENVIRONMENT'],
    600000, 900000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"Dakar","country":"SN","label":"Dakar + terrain Kédougou"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '21 days'
  );

INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, organization_id, sectors, location_type, locations, status, visibility, deadline)
VALUES
  (
    'c0000007-0004-4000-c000-000000000004',
    'Co-fondateur(rice) Plateforme EdTech Sénégal',
    'cofondateur-edtech-senegal',
    'ENTREPRENEURSHIP', 'FREELANCE', 'FULL_TIME',
    'Création d''une plateforme de formation en ligne adaptée au contexte sénégalais. Recherche d''un(e) co-fondateur(rice) technique ou pédagogique pour structurer l''offre de cours et développer la plateforme.',
    'Expérience en éducation ou ed-tech. Passion pour l''enseignement. Prêt(e) à travailler en equity. Réseau dans le milieu éducatif sénégalais apprécié.',
    'b1b2c3d4-3333-4000-b000-000000000003',
    ARRAY['DIGITAL', 'EDUCATION'],
    'HYBRID',
    '[{"city":"Dakar","country":"SN","label":"Dakar"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '60 days'
  ),
  (
    'c0000007-0005-4000-c000-000000000005',
    'Alternance Technicien Solaire',
    'alternance-technicien-solaire-thies',
    'ALTERNATION', 'APPRENTICESHIP', 'PART_TIME',
    'Programme d''alternance de 12 mois : 3 jours sur chantier, 2 jours en centre de formation à Thiès. Installation, câblage et maintenance de systèmes solaires photovoltaïques résidentiels et industriels.',
    'Étudiant(e) en BTS Électrotechnique ou Énergie Renouvelable. Motivation pour le terrain. Permis B souhaité.',
    'b1b2c3d4-4444-4000-b000-000000000004',
    ARRAY['ENERGY', 'ENVIRONMENT'],
    'ON_SITE',
    '[{"city":"Thiès","country":"SN","label":"Thiès + terrain national"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '30 days'
  ),
  (
    'c0000007-0006-4000-c000-000000000006',
    'Bénévole Formateur Coding pour Jeunes (Dakar)',
    'benevole-formateur-coding-dakar',
    'VOLUNTEER', 'SERVICE', 'OCCASIONAL',
    'Initiez des jeunes de 14 à 20 ans à la programmation lors de nos ateliers Scratch et Python organisés chaque samedi matin à Dakar. 3h par semaine, support pédagogique fourni.',
    'Développeur(se) avec au moins 1 an d''expérience. Pédagogue et patient(e). Français courant, wolof apprécié.',
    'b1b2c3d4-3333-4000-b000-000000000003',
    ARRAY['DIGITAL', 'EDUCATION', 'SOCIAL_IMPACT'],
    'ON_SITE',
    '[{"city":"Dakar","country":"SN","label":"Almadies, Dakar"}]'::jsonb,
    'OPEN', 'PUBLIC',
    NOW() + INTERVAL '90 days'
  );

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- RÉSUMÉ DU SEED
-- ═══════════════════════════════════════════════════════════════
-- Talents    : 5 (3 CI + 2 SN)
-- Orgs       : 4 (2 CI + 2 SN)
-- Communautés: 8 (4 CI + 4 SN) avec coordonnées GPS réelles
-- Espaces    : 8 (4 CI + 4 SN) avec coordonnées GPS réelles
-- Opportunités: 24 (18 CI + 6 SN)
-- Skills     : 29 (17 CI + 12 SN)
-- Documents  : 2 (CV + Diplôme pour Aminata)
-- ═══════════════════════════════════════════════════════════════
