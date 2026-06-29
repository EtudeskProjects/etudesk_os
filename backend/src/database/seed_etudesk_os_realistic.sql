-- ═════════════════════════════════════════════════════════════════════
-- ETUDESK OS — ULTRA REALISTIC SEED (global digital-skills flavored)
-- - 20 talents (including main: etudesksas@gmail.com / +2250574631148)
-- - 1 organization (linked to main talent)
-- - opportunities + applications + application messages
-- - spaces + bookings
-- - communities (groups) + memberships + activities + comments + reactions + polls
-- - local SVG avatars/covers (African-only stylized illustrations): /uploads/seed/...
--
-- Designed to match backend validation constants:
-- - profile_tags/goals/sectors: validation.middleware.ts
-- - opportunity types/contract/work_rhythm/location/status: validation.middleware.ts
-- - space types/equipment/amenities: src/types/space.types.ts
-- - community member role/status/activity type/status/moderation_status: schema checks
-- ═════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Stable IDs
-- ---------------------------------------------------------------------

-- Talents (20)
-- 9000.... = talents
-- 9100.... = users
-- 9200.... = talent skills
-- 1000.... = organization
-- 1100.... = communities
-- 1200.... = activities/comments/polls
-- 2000.... = opportunities + applications/messages
-- 3000.... = spaces + bookings/messages

-- ---------------------------------------------------------------------
-- 1) Talents + Users
-- ---------------------------------------------------------------------

INSERT INTO talents (
  id, slug, first_name, last_name, bio, avatar_url, gender,
  email, phone, city, region, country,
  remote_ready, willing_to_relocate,
  profile_tags, goals, sectors,
  is_visible
) VALUES
  (
    '90000000-0000-4000-8000-000000000001',
    'lamine-barro',
    'Lamine', 'Barro',
    'Fondateur d''Etudesk. Produit, stratégie et exécution. Je construis des solutions EdTech et TalentTech pour l''Afrique de l''Ouest, avec un focus sur l''emploi, l''upskilling et les communautés.',
    '/uploads/seed/avatars/lamine-barro.svg',
    'male',
    'etudesksas@gmail.com',
    '+2250574631148',
    'New York', 'New York', 'US',
    true, true,
    ARRAY['ENTREPRENEUR','MANAGER'],
    ARRAY['BUILD_NETWORK_OR_VISIBILITY','CONTRIBUTE_OR_GIVE_BACK','ADVANCE_CAREER'],
    ARRAY['TECH','EDUCATION','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    'aminata-kone',
    'Aminata', 'Koné',
    'Développeuse Full Stack (React/Node) orientée produit. Expérience sur des plateformes d''apprentissage, CRM et paiements. Forte sensibilité UX et qualité.',
    'https://images.unsplash.com/photo-1687355930823-65b5ef5aab2c?w=400&h=400&fit=crop&crop=face',
    'female',
    'aminata.kone@etudesk.demo',
    '+2250701010101',
    'New York', 'New York', 'US',
    true, false,
    ARRAY['JOB_SEEKER'],
    ARRAY['FIND_JOB','LEARN_NEW_SKILLS','ADVANCE_CAREER'],
    ARRAY['TECH'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    'moussa-diallo',
    'Moussa', 'Diallo',
    'Étudiant en fin de cycle ingénieur (Génie Civil). Recherche alternance/mission terrain, planification et suivi de chantiers. À l''aise avec Excel, métrés, et coordination.',
    'https://images.unsplash.com/photo-1612214070782-b97cad77ca54?w=400&h=400&fit=crop&crop=face',
    'male',
    'moussa.diallo@etudesk.demo',
    '+2250702020202',
    'Yamoussoukro', 'Lacs', 'US',
    false, true,
    ARRAY['STUDENT'],
    ARRAY['FIND_JOB','PREPARE_EXAMS','LEARN_NEW_SKILLS'],
    ARRAY['INDUSTRY','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000004',
    'fatou-traore',
    'Fatou', 'Traoré',
    'Consultante en marketing digital. Spécialisée en acquisition, contenu et partenariats. A accompagné des PME et des programmes d''incubation.',
    'https://images.unsplash.com/photo-1687355931379-2afd82f6ee48?w=400&h=400&fit=crop&crop=face',
    'female',
    'fatou.traore@etudesk.demo',
    '+2250703030303',
    'New York', 'New York', 'US',
    true, false,
    ARRAY['CONSULTANT','ENTREPRENEUR'],
    ARRAY['ADVANCE_CAREER','BUILD_NETWORK_OR_VISIBILITY','TEACH_OR_MENTOR'],
    ARRAY['MEDIA','RETAIL','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000005',
    'awa-diop',
    'Awa', 'Diop',
    'Data analyst (SQL, Power BI) avec sens business. Je transforme des données en décisions: dashboards, KPI, analyses cohortes, recommandations produit.',
    'https://images.unsplash.com/photo-1687356356861-bd761c683829?w=400&h=400&fit=crop&crop=face',
    'female',
    'awa.diop@etudesk.demo',
    '+221770404040',
    'Berlin', 'Berlin', 'DE',
    true, false,
    ARRAY['SALARIED'],
    ARRAY['ADVANCE_CAREER','IMPROVE_PRODUCTIVITY','LEARN_NEW_SKILLS'],
    ARRAY['TECH','FINANCE'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000006',
    'ibrahim-oue',
    'Ibrahim', 'Ouédraogo',
    'Développeur backend Node.js/TypeScript. Focus API, sécurité, performance et intégrations (paiements, email).',
    'https://images.unsplash.com/photo-1612214070495-ffc6b69cda4b?w=400&h=400&fit=crop&crop=face',
    'male',
    'ibrahim.ouedraogo@etudesk.demo',
    '+22670050505',
    'Ouagadougou', 'Centre', 'BF',
    true, true,
    ARRAY['JOB_SEEKER'],
    ARRAY['FIND_JOB','ADVANCE_CAREER'],
    ARRAY['TECH'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000007',
    'kadiatou-coulibaly',
    'Kadiatou', 'Coulibaly',
    'Responsable RH et talent acquisition. Mise en place de process, scorecards, onboarding, culture. Expérience dans une startup en croissance.',
    'https://images.unsplash.com/photo-1685634115415-4fd59062a34e?w=400&h=400&fit=crop&crop=face',
    'female',
    'kadiatou.coulibaly@etudesk.demo',
    '+2250707070707',
    'New York', 'New York', 'US',
    true, false,
    ARRAY['MANAGER','SALARIED'],
    ARRAY['IMPROVE_PRODUCTIVITY','BUILD_NETWORK_OR_VISIBILITY'],
    ARRAY['SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000008',
    'ousmane-gueye',
    'Ousmane', 'Gueye',
    'Ingénieur DevOps. Docker, CI/CD, observabilité, infra cloud. J''aime rendre les systèmes simples à opérer.',
    'https://images.unsplash.com/photo-1612214070442-3c806a722f0b?w=400&h=400&fit=crop&crop=face',
    'male',
    'ousmane.gueye@etudesk.demo',
    '+221780808080',
    'Thiès', 'Thiès', 'DE',
    true, true,
    ARRAY['SALARIED'],
    ARRAY['ADVANCE_CAREER','LEARN_NEW_SKILLS'],
    ARRAY['TECH','ENERGY'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000009',
    'adjoua-bamba',
    'Adjoua', 'Bamba',
    'Coach carrière. CV, préparation d''entretien et stratégie de recherche. Expérience dans l''accompagnement de jeunes diplômés.',
    'https://images.unsplash.com/photo-1687275217604-3199c27b8120?w=400&h=400&fit=crop&crop=face',
    'female',
    'adjoua.bamba@etudesk.demo',
    '+2250709090909',
    'Bouaké', 'Vallée du Bandama', 'US',
    false, false,
    ARRAY['COACH','CONSULTANT'],
    ARRAY['TEACH_OR_MENTOR','CONTRIBUTE_OR_GIVE_BACK','BUILD_NETWORK_OR_VISIBILITY'],
    ARRAY['EDUCATION','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000010',
    'cheick-sanogo',
    'Cheick', 'Sanogo',
    'Entrepreneur retail. Mise en place de points de vente, gestion stock, mobile money, formation vendeurs. Objectif: scaler through online and partner channels.',
    'https://images.unsplash.com/photo-1634059096500-d820a94fd335?w=400&h=400&fit=crop&crop=face',
    'male',
    'cheick.sanogo@etudesk.demo',
    '+2250710101010',
    'New York', 'New York', 'US',
    false, true,
    ARRAY['ENTREPRENEUR'],
    ARRAY['IMPROVE_PRODUCTIVITY','BUILD_NETWORK_OR_VISIBILITY'],
    ARRAY['RETAIL','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000011',
    'mariama-faye',
    'Mariama', 'Faye',
    'Community builder. Animation de groupes, modération, programme d''événements et contenus pédagogiques. À l''aise avec la création de formats.',
    'https://images.unsplash.com/photo-1687355428097-b719636775d2?w=400&h=400&fit=crop&crop=face',
    'female',
    'mariama.faye@etudesk.demo',
    '+221760111111',
    'Berlin', 'Berlin', 'DE',
    true, false,
    ARRAY['CONTENT_CREATOR'],
    ARRAY['BUILD_NETWORK_OR_VISIBILITY','TEACH_OR_MENTOR','LEARN_NEW_SKILLS'],
    ARRAY['MEDIA','EDUCATION'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000012',
    'konan-yao',
    'Konan', 'Yao',
    'Ingénieur énergie. Projets solaires et efficacité énergétique. Suivi de performance, reporting et opérations terrain.',
    'https://images.unsplash.com/photo-1616987553948-4818e3cef2d2?w=400&h=400&fit=crop&crop=face',
    'male',
    'konan.yao@etudesk.demo',
    '+2250712121212',
    'San-Pédro', 'Bas-Sassandra', 'US',
    true, true,
    ARRAY['SALARIED'],
    ARRAY['ADVANCE_CAREER','LEARN_NEW_SKILLS'],
    ARRAY['ENERGY','INDUSTRY'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000013',
    'ndeye-ndiaye',
    'Ndeye', 'Ndiaye',
    'Étudiante en santé publique. Intérêt pour la data santé, recherche et projets d''impact. Besoin d''un mentorat méthodo et carrière.',
    'https://images.unsplash.com/photo-1687355428055-895b093e0ebb?w=400&h=400&fit=crop&crop=face',
    'female',
    'ndeye.ndiaye@etudesk.demo',
    '+221750131313',
    'Saint-Louis', 'Saint-Louis', 'DE',
    true, false,
    ARRAY['STUDENT'],
    ARRAY['PREPARE_EXAMS','LEARN_NEW_SKILLS','RESEARCH_SUPPORT'],
    ARRAY['HEALTH','EDUCATION'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000014',
    'sekou-keita',
    'Sékou', 'Keita',
    'Développeur mobile (React Native). Livraison rapide, offline-first, analytics. Expérience sur apps terrain (agri/retail).',
    'https://images.unsplash.com/photo-1665904176973-056b4d5d10c7?w=400&h=400&fit=crop&crop=face',
    'male',
    'sekou.keita@etudesk.demo',
    '+223760141414',
    'Bamako', 'Bamako', 'ML',
    true, true,
    ARRAY['JOB_SEEKER'],
    ARRAY['FIND_JOB','LEARN_NEW_SKILLS','ADVANCE_CAREER'],
    ARRAY['TECH','AGRICULTURE'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000015',
    'aicha-sow',
    'Aïcha', 'Sow',
    'Entrepreneure agro. Structuration des filières, marketing, distribution. Je cherche des partenariats et un appui financement.',
    'https://images.unsplash.com/photo-1645092708550-2632c574bbfd?w=400&h=400&fit=crop&crop=face',
    'female',
    'aicha.sow@etudesk.demo',
    '+221770151515',
    'Ziguinchor', 'Ziguinchor', 'DE',
    false, true,
    ARRAY['ENTREPRENEUR'],
    ARRAY['BUILD_NETWORK_OR_VISIBILITY','IMPROVE_PRODUCTIVITY'],
    ARRAY['AGRICULTURE','RETAIL'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000016',
    'jeanne-ouattara',
    'Jeanne', 'Ouattara',
    'Formatrice bureautique et compétences pro. J''anime des ateliers Excel/PowerPoint et coaching d''employabilité.',
    'https://images.unsplash.com/photo-1628682819415-afbd0eb5f93a?w=400&h=400&fit=crop&crop=face',
    'female',
    'jeanne.ouattara@etudesk.demo',
    '+2250716161616',
    'New York', 'New York', 'US',
    true, false,
    ARRAY['COACH'],
    ARRAY['TEACH_OR_MENTOR','CONTRIBUTE_OR_GIVE_BACK'],
    ARRAY['EDUCATION','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000017',
    'tidiane-cisse',
    'Tidiane', 'Cissé',
    'Product manager. Roadmap, discovery, métriques, go-to-market. Je travaille bien avec tech et business.',
    'https://images.unsplash.com/photo-1612214070475-1e73f478188c?w=400&h=400&fit=crop&crop=face',
    'male',
    'tidiane.cisse@etudesk.demo',
    '+2250717171717',
    'New York', 'New York', 'US',
    true, false,
    ARRAY['MANAGER','SALARIED'],
    ARRAY['ADVANCE_CAREER','IMPROVE_PRODUCTIVITY'],
    ARRAY['TECH','SERVICES'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000018',
    'estelle-zongo',
    'Estelle', 'Zongo',
    'Designer UX/UI. Design system, prototypage, recherche utilisateur, parcours mobile. Focus accessibilité et clarté.',
    'https://images.unsplash.com/photo-1628682816572-e4d327755dc4?w=400&h=400&fit=crop&crop=face',
    'female',
    'estelle.zongo@etudesk.demo',
    '+226700181818',
    'Bobo-Dioulasso', 'Hauts-Bassins', 'BF',
    true, true,
    ARRAY['JOB_SEEKER'],
    ARRAY['FIND_JOB','ADVANCE_CAREER'],
    ARRAY['TECH','MEDIA'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000019',
    'boubacar-diarra',
    'Boubacar', 'Diarra',
    'Ops/logistique. Optimisation des tournées, gestion entrepôt, indicateurs, qualité service. Intérêt pour l''automatisation.',
    'https://images.unsplash.com/photo-1616076875452-f05f2865fe65?w=400&h=400&fit=crop&crop=face',
    'male',
    'boubacar.diarra@etudesk.demo',
    '+223760191919',
    'Sikasso', 'Sikasso', 'ML',
    false, true,
    ARRAY['SALARIED'],
    ARRAY['IMPROVE_PRODUCTIVITY','ADVANCE_CAREER'],
    ARRAY['TRANSPORT','INDUSTRY'],
    true
  ),
  (
    '90000000-0000-4000-8000-000000000020',
    'coumba-fall',
    'Coumba', 'Fall',
    'Chargée de programme (impact). Suivi-évaluation, partenariats, gestion des bénéficiaires. Je veux structurer des programmes d''employabilité.',
    'https://images.unsplash.com/photo-1628682814595-a3f0816b25ff?w=400&h=400&fit=crop&crop=face',
    'female',
    'coumba.fall@etudesk.demo',
    '+221770202020',
    'Berlin', 'Berlin', 'DE',
    true, false,
    ARRAY['CONSULTANT'],
    ARRAY['CONTRIBUTE_OR_GIVE_BACK','BUILD_NETWORK_OR_VISIBILITY'],
    ARRAY['SERVICES','EDUCATION'],
    true
  );

-- Create users for each talent (email_verified=true)
INSERT INTO users (id, email, email_verified, talent_id, is_active)
SELECT
  ('91000000-0000-4000-8000-' || lpad((row_number() OVER (ORDER BY t.id))::text, 12, '0'))::uuid,
  t.email,
  true,
  t.id,
  true
FROM talents t
WHERE t.id::text LIKE '90000000-0000-4000-8000-%';

-- ---------------------------------------------------------------------
-- 2) Talent Skills (catalog-constrained: competency_slug + level)
-- ---------------------------------------------------------------------

-- Talent skills are catalog-constrained (migration 021). Seed them via
-- scripts/seed-minimal.ts or scripts/seed-demo.ts (labels resolved to catalog slugs).

-- ---------------------------------------------------------------------
-- 2b) Talent Documents (CV PDFs + attestations)
-- Files are local under /uploads/seed/documents/... (served by /uploads)
-- ---------------------------------------------------------------------

INSERT INTO talent_documents (
  id, talent_id,
  original_filename, stored_filename,
  mime_type, file_size, file_url,
  document_type, category, status,
  processed_at,
  tags, title, description,
  is_public, is_verified
) VALUES
  -- Lamine
  (
    '93000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'CV_Lamine_Barro.pdf',
    'seed/documents/lamine-barro/CV_lamine-barro.pdf',
    'application/pdf',
    180000,
    '/uploads/seed/documents/lamine-barro/CV_lamine-barro.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','etudesk','seed'],
    'CV - Lamine Barro',
    'CV de démonstration (seed Etudesk OS).',
    true,false
  ),
  -- Aminata
  (
    '93000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    'CV_Aminata_Kone.pdf',
    'seed/documents/aminata-kone/CV_aminata-kone.pdf',
    'application/pdf',
    170000,
    '/uploads/seed/documents/aminata-kone/CV_aminata-kone.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','fullstack','seed'],
    'CV - Aminata Koné',
    'CV de démonstration (seed).',
    true,false
  ),
  (
    '93000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000002',
    'Attestation_Aminata_Kone.pdf',
    'seed/documents/aminata-kone/CERT_aminata-kone.pdf',
    'application/pdf',
    120000,
    '/uploads/seed/documents/aminata-kone/CERT_aminata-kone.pdf',
    'CERTIFICATE','ACADEMIC','PROCESSED',
    NOW(),
    ARRAY['attestation','seed'],
    'Attestation - Atelier Etudesk OS',
    NULL,
    true,false
  ),
  -- Awa
  (
    '93000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000005',
    'CV_Awa_Diop.pdf',
    'seed/documents/awa-diop/CV_awa-diop.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/awa-diop/CV_awa-diop.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','data','seed'],
    'CV - Awa Diop',
    NULL,
    true,false
  ),
  (
    '93000000-0000-4000-8000-000000000005',
    '90000000-0000-4000-8000-000000000005',
    'Attestation_Awa_Diop.pdf',
    'seed/documents/awa-diop/CERT_awa-diop.pdf',
    'application/pdf',
    120000,
    '/uploads/seed/documents/awa-diop/CERT_awa-diop.pdf',
    'CERTIFICATE','ACADEMIC','PROCESSED',
    NOW(),
    ARRAY['attestation','seed'],
    'Attestation - Atelier KPI',
    NULL,
    true,false
  ),
  -- Estelle
  (
    '93000000-0000-4000-8000-000000000006',
    '90000000-0000-4000-8000-000000000018',
    'CV_Estelle_Zongo.pdf',
    'seed/documents/estelle-zongo/CV_estelle-zongo.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/estelle-zongo/CV_estelle-zongo.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','ux','seed'],
    'CV - Estelle Zongo',
    NULL,
    true,false
  ),
  (
    '93000000-0000-4000-8000-000000000007',
    '90000000-0000-4000-8000-000000000018',
    'Attestation_Estelle_Zongo.pdf',
    'seed/documents/estelle-zongo/CERT_estelle-zongo.pdf',
    'application/pdf',
    120000,
    '/uploads/seed/documents/estelle-zongo/CERT_estelle-zongo.pdf',
    'CERTIFICATE','ACADEMIC','PROCESSED',
    NOW(),
    ARRAY['attestation','seed'],
    'Attestation - Atelier UX',
    NULL,
    true,false
  ),
  -- Ousmane
  (
    '93000000-0000-4000-8000-000000000008',
    '90000000-0000-4000-8000-000000000008',
    'CV_Ousmane_Gueye.pdf',
    'seed/documents/ousmane-gueye/CV_ousmane-gueye.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/ousmane-gueye/CV_ousmane-gueye.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','devops','seed'],
    'CV - Ousmane Gueye',
    NULL,
    true,false
  ),
  -- Kadiatou
  (
    '93000000-0000-4000-8000-000000000009',
    '90000000-0000-4000-8000-000000000007',
    'CV_Kadiatou_Coulibaly.pdf',
    'seed/documents/kadiatou-coulibaly/CV_kadiatou-coulibaly.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/kadiatou-coulibaly/CV_kadiatou-coulibaly.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','hr','seed'],
    'CV - Kadiatou Coulibaly',
    NULL,
    true,false
  ),
  -- Moussa
  (
    '93000000-0000-4000-8000-000000000010',
    '90000000-0000-4000-8000-000000000003',
    'CV_Moussa_Diallo.pdf',
    'seed/documents/moussa-diallo/CV_moussa-diallo.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/moussa-diallo/CV_moussa-diallo.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','ops','seed'],
    'CV - Moussa Diallo',
    NULL,
    true,false
  ),
  -- Mariama
  (
    '93000000-0000-4000-8000-000000000011',
    '90000000-0000-4000-8000-000000000011',
    'CV_Mariama_Faye.pdf',
    'seed/documents/mariama-faye/CV_mariama-faye.pdf',
    'application/pdf',
    160000,
    '/uploads/seed/documents/mariama-faye/CV_mariama-faye.pdf',
    'CV','PROFESSIONAL','PROCESSED',
    NOW(),
    ARRAY['cv','community','seed'],
    'CV - Mariama Faye',
    NULL,
    true,false
  );

-- ---------------------------------------------------------------------
-- 3) Organization (unique) + membership
-- ---------------------------------------------------------------------

INSERT INTO organizations (
  id, name, slug, types, sectors, description,
  logo_url, website_url, contact_email, contact_phone,
  headquarters_city, headquarters_region, headquarters_country,
  verification_status, is_visible, created_by, culture_summary
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'Etudesk SAS',
  'etudesk-sas',
  ARRAY['STARTUP','CONSULTING_FIRM'],
  ARRAY['TECH','EDUCATION','SERVICES'],
  'Etudesk conçoit des solutions numériques pour l''orientation, l''employabilité, et la formation. Ce seed simule une organisation active: offres, réservations d''espaces, et animation de communautés.',
  '/uploads/seed/covers/org-etudesk-sas.svg',
  'https://etudesk.com',
  'etudesksas@gmail.com',
  '+2250574631148',
  'New York', 'New York', 'US',
  'OFFICIAL',
  true,
  '90000000-0000-4000-8000-000000000001',
  'Culture orientée impact, vitesse d''exécution, et obsession pour la clarté.'
);

INSERT INTO organization_members (organization_id, talent_id, role, status, permissions)
VALUES
  ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','OWNER','ACTIVE',ARRAY['ORG_ADMIN','BILLING','POST_OPPORTUNITIES','MANAGE_SPACES']),
  ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000007','MANAGER','ACTIVE',ARRAY['RECRUITING','HR']),
  ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000017','MANAGER','ACTIVE',ARRAY['PRODUCT','OPS']),
  ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','MEMBER','ACTIVE',ARRAY['MARKETING']);

-- ---------------------------------------------------------------------
-- 4) Communities (groups) + memberships
-- ---------------------------------------------------------------------

INSERT INTO communities (
  id, name, slug, type, description, rules,
  access_type, visibility,
  tags, sectors,
  city, region, country,
  cover_image_url, images,
  status, created_by, organization_id,
  is_paid, monthly_price, currency, trial_period_days
) VALUES
  (
    '11000000-0000-4000-8000-000000000001',
    'Etudesk OS: Tech & Data CI',
    'etudesk-os-tech-data-ci',
    'LEARNING',
    'Groupe pour apprendre, partager et trouver des opportunités (dev, data, produit). Discussions techniques, ressources, entraide.',
    'Respect, pas de spam, partage de sources. Les offres doivent être précises (mission, stack, rémunération).',
    'OPEN', 'PUBLIC',
    '["tech","data","mentorat","abidjan"]'::jsonb,
    '["TECH","FINANCE","EDUCATION"]'::jsonb,
    'New York','New York','US',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop'],
    'ACTIVE',
    '90000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    false, NULL, 'XOF', 0
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'Etudesk OS: Entrepreneurs CI',
    'etudesk-os-entrepreneurs-ci',
    'PROFESSIONAL',
    'Groupe pour entrepreneurs (retail, services, agro). Conseils opérationnels, ventes, financement, recrutement.',
    'On est direct et concret. Pas de promesses vagues. Partagez vos chiffres, vos contraintes, vos prochaines actions.',
    'APPROVAL', 'PUBLIC',
    '["entrepreneuriat","vente","operations"]'::jsonb,
    '["RETAIL","SERVICES","AGRICULTURE"]'::jsonb,
    'New York','New York','US',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=400&fit=crop'],
    'ACTIVE',
    '90000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000001',
    false, NULL, 'XOF', 0
  );

-- Add all 20 talents as members (with a few admins)
INSERT INTO community_members (talent_id, community_id, role, status, accepted_rules, membership_type)
SELECT t.id, c.id,
  CASE
    WHEN t.id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000011') AND c.id='11000000-0000-4000-8000-000000000001' THEN 'ADMIN'
    WHEN t.id IN ('90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000004') AND c.id='11000000-0000-4000-8000-000000000002' THEN 'ADMIN'
    ELSE 'MEMBER'
  END,
  'ACTIVE',
  true,
  'MEMBER'
FROM talents t
CROSS JOIN (SELECT id FROM communities WHERE id IN ('11000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002')) c
WHERE t.id::text LIKE '90000000-0000-4000-8000-%';

-- ---------------------------------------------------------------------
-- 5) Community content: posts/events/polls + comments/reactions/votes
-- ---------------------------------------------------------------------

INSERT INTO community_activities (
  id, community_id, author_id, type, content, metadata, attachments,
  is_pinned, status, moderation_status, published_at
) VALUES
  (
    '12000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'POST',
    'Thread: vos meilleures ressources pour progresser en SQL (niveau débutant -> intermédiaire). Partagez 1 lien + 1 mini-exercice.',
    '{"topic":"sql","level":"beginner_to_intermediate"}'::jsonb,
    '[]'::jsonb,
    true,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '2 days'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000005',
    'POST',
    'J''ai publié un dashboard de suivi candidatures (applications -> interviews -> offres). Si vous voulez le modèle, dites votre stack (Excel/Sheets/BI).',
    '{"topic":"analytics","artifact":"dashboard"}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '1 day'
  ),
  (
    '12000000-0000-4000-8000-000000000003',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000011',
    'EVENT',
    'Live (45 min): Comment structurer un portfolio crédible en 7 jours. Lien visio dans les commentaires. Objectif: un projet simple, mesurable, et raconté.',
    jsonb_build_object(
      'starts_at', (NOW() + INTERVAL '5 days'),
      'duration_minutes', 45,
      'city', 'New York'
    ),
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW()
  ),
  (
    '12000000-0000-4000-8000-000000000004',
    '11000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000010',
    'POLL',
    'Sondage: quel est votre plus gros blocage pour scaler vos ventes en 2026 ?',
    '{"topic":"sales"}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '3 days'
  );

INSERT INTO community_poll_options (id, activity_id, text, order_index) VALUES
  ('12000000-0000-4000-8000-000000000101','12000000-0000-4000-8000-000000000004','Acquisition (trouver des clients)',0),
  ('12000000-0000-4000-8000-000000000102','12000000-0000-4000-8000-000000000004','Conversion (vendre plus à trafic constant)',1),
  ('12000000-0000-4000-8000-000000000103','12000000-0000-4000-8000-000000000004','Opérations (stock, équipe, process)',2),
  ('12000000-0000-4000-8000-000000000104','12000000-0000-4000-8000-000000000004','Cash (financement, trésorerie)',3);

-- Votes: everyone votes once
INSERT INTO community_poll_votes (activity_id, option_id, user_id, created_at)
SELECT
  '12000000-0000-4000-8000-000000000004',
  (CASE
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 1 THEN '12000000-0000-4000-8000-000000000101'
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 2 THEN '12000000-0000-4000-8000-000000000102'
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 3 THEN '12000000-0000-4000-8000-000000000103'
    ELSE '12000000-0000-4000-8000-000000000104'
  END)::uuid,
  t.id,
  NOW() - INTERVAL '2 days'
FROM talents t
WHERE t.id::text LIKE '90000000-0000-4000-8000-%';

-- A few comments + replies
INSERT INTO community_activity_comments (id, activity_id, author_id, content, parent_id, moderation_status)
VALUES
  ('12000000-0000-4000-8000-000000000201','12000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000005','Je recommande 1) SELECT basics + JOINs, 2) window functions. Mini-exo: cohortes mensuelles.',NULL,'APPROVED'),
  ('12000000-0000-4000-8000-000000000202','12000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Exo simple: top 10 opportunités les plus consultées, puis par secteur.',NULL,'APPROVED'),
  ('12000000-0000-4000-8000-000000000203','12000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000006','+1 pour window functions. Ajoutez aussi l''indexing et EXPLAIN.',NULL,'APPROVED'),
  ('12000000-0000-4000-8000-000000000204','12000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Excellent. Je propose: on compile une liste et on fait une session pratique.', '12000000-0000-4000-8000-000000000203','APPROVED');

-- Reactions (likes) on the pinned post
INSERT INTO community_activity_reactions (activity_id, user_id, type)
SELECT '12000000-0000-4000-8000-000000000001', t.id, 'LIKE'
FROM talents t
WHERE t.id IN (
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000005',
  '90000000-0000-4000-8000-000000000006',
  '90000000-0000-4000-8000-000000000008',
  '90000000-0000-4000-8000-000000000017'
);

-- More realistic group content
INSERT INTO community_activities (
  id, community_id, author_id, type, content, metadata, attachments,
  is_pinned, status, moderation_status, published_at
) VALUES
  (
    '12000000-0000-4000-8000-000000000005',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000006',
    'POST',
    'API security checklist (pratique): 1) rate limit, 2) validation, 3) logs structurés, 4) RBAC, 5) audit trails. Qui veut une version template ?',
    '{"topic":"security","format":"checklist"}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '4 hours'
  ),
  (
    '12000000-0000-4000-8000-000000000006',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000017',
    'POST',
    'Produit: 3 métriques utiles en early-stage (sans vanity). 1) activation (Aha), 2) rétention (D7/D30), 3) délai valeur (time-to-value).',
    '{"topic":"product","kpi":["activation","retention","time_to_value"]}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '6 hours'
  ),
  (
    '12000000-0000-4000-8000-000000000007',
    '11000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000010',
    'POST',
    'Retail: comment vous gérez le stock au quotidien ? Je propose un mini-template (entrées/sorties + ruptures + top ventes).',
    '{"topic":"ops","domain":"retail"}'::jsonb,
    '[]'::jsonb,
    true,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '5 days'
  ),
  (
    '12000000-0000-4000-8000-000000000008',
    '11000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000015',
    'POST',
    'Agro: on a testé 2 canaux (messagerie directe vs revendeurs). Résultat: revendeurs gagnent en volume, messagerie directe en marge. Partage des leçons si intéressés.',
    '{"topic":"distribution","domain":"agriculture"}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '2 days'
  ),
  (
    '12000000-0000-4000-8000-000000000009',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    'POLL',
    'Sondage: quel format de contenu vous aide le plus à progresser ?',
    '{"topic":"learning"}'::jsonb,
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '12 hours'
  ),
  (
    '12000000-0000-4000-8000-000000000010',
    '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000016',
    'EVENT',
    'Atelier (2h): Excel pour KPI employabilité (tableaux, filtres, graphiques). Places limitées. Inscription en commentaire.',
    jsonb_build_object(
      'starts_at', (NOW() + INTERVAL '8 days'),
      'duration_minutes', 120,
      'city', 'New York',
      'space', 'Salle Formation Plateau'
    ),
    '[]'::jsonb,
    false,
    'PUBLISHED',
    'APPROVED',
    NOW() - INTERVAL '1 hour'
  );

INSERT INTO community_poll_options (id, activity_id, text, order_index) VALUES
  ('12000000-0000-4000-8000-000000000105','12000000-0000-4000-8000-000000000009','Micro-cours (10-15 min)',0),
  ('12000000-0000-4000-8000-000000000106','12000000-0000-4000-8000-000000000009','Exercices guidés',1),
  ('12000000-0000-4000-8000-000000000107','12000000-0000-4000-8000-000000000009','Templates + checklists',2),
  ('12000000-0000-4000-8000-000000000108','12000000-0000-4000-8000-000000000009','Live Q&A',3);

INSERT INTO community_poll_votes (activity_id, option_id, user_id, created_at)
SELECT
  '12000000-0000-4000-8000-000000000009',
  (CASE
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 1 THEN '12000000-0000-4000-8000-000000000105'
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 2 THEN '12000000-0000-4000-8000-000000000106'
    WHEN (row_number() OVER (ORDER BY t.id)) % 4 = 3 THEN '12000000-0000-4000-8000-000000000107'
    ELSE '12000000-0000-4000-8000-000000000108'
  END)::uuid,
  t.id,
  NOW() - INTERVAL '8 hours'
FROM talents t
WHERE t.id::text LIKE '90000000-0000-4000-8000-%';

INSERT INTO community_activity_comments (id, activity_id, author_id, content, parent_id, moderation_status)
VALUES
  ('12000000-0000-4000-8000-000000000205','12000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000008','Template CI/CD + alerting m''intéresse.',NULL,'APPROVED'),
  ('12000000-0000-4000-8000-000000000206','12000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000020','Je veux le template stock. On a trop de ruptures sur 3 produits.',NULL,'APPROVED'),
  ('12000000-0000-4000-8000-000000000207','12000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000009','Je m''inscris pour co-animer la partie CV.',NULL,'APPROVED');

INSERT INTO community_activity_reactions (activity_id, user_id, type)
VALUES
  ('12000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000004','LIKE'),
  ('12000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000015','LIKE'),
  ('12000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000001','LIKE'),
  ('12000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000005','LIKE');

-- ---------------------------------------------------------------------
-- 6) Opportunities + posters + applications + messages
-- ---------------------------------------------------------------------

INSERT INTO opportunities (
  id, title, slug,
  type, contract_type, work_rhythm,
  summary, requirements, nice_to_have,
  organization_id,
  sectors,
  cv_required,
  application_questions,
  cover_image_url, images, attachments,
  compensation_min, compensation_max, currency, compensation_frequency,
  location_type, locations,
  visibility,
  posted_at, deadline, start_date, duration,
  status,
  ideal_candidate_summary
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Développeur Full Stack (React/Node) - Etudesk OS',
    'dev-fullstack-etudesk-os',
    'EMPLOYMENT','CDI','FULL_TIME',
    'Construire et itérer sur Etudesk OS: onboarding, communautés, opportunités, réservation d''espaces. Qualité, clarté et vitesse.',
    '- React/TypeScript solide\n- API Node/Express\n- PostgreSQL + modélisation\n- Autonomie et rigueur\n',
    'Expérience SSE, Postgres JSONB, tests API.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['TECH'],
    true,
    '[{"id":"q1","question":"Raconte un projet dont tu es fier(e) (impact mesuré).","required":true},{"id":"q2","question":"Ta stack préférée et pourquoi ?","required":true}]'::jsonb,
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    600000, 1200000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"New York","region":"New York","country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '21 days',
    CURRENT_DATE + 30,
    INTERVAL '6 months',
    'OPEN',
    'Orienté exécution. Confortable avec des itérations rapides et des arbitrages.'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Data Analyst (KPI & dashboards) - Employabilité',
    'data-analyst-employabilite',
    'EMPLOYMENT','CDD','FULL_TIME',
    'Mettre en place un reporting de bout en bout: candidats, offres, matching, activation communauté. KPIs, analyses et recommandations.',
    '- SQL (joins, window functions)\n- Power BI / Looker Studio\n- Communication claire\n',
    'Expérience produit (funnel, cohorts).',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['TECH','FINANCE'],
    false,
    '[{"id":"q1","question":"Quelle est ta méthode pour définir de bons KPI ?","required":true}]'::jsonb,
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    450000, 900000, 'XOF', 'MONTHLY',
    'REMOTE',
    '[{"city":"New York","country":"US","is_primary":true},{"city":"Berlin","country":"DE"}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '4 days',
    NOW() + INTERVAL '18 days',
    CURRENT_DATE + 21,
    INTERVAL '3 months',
    'OPEN',
    'Capable d''expliquer ses analyses à des non-techniques.'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Community Manager (Groupes + contenus)',
    'community-manager-groupes',
    'FREELANCE','SERVICE','PART_TIME',
    'Animer les groupes, publier du contenu utile, modérer, et organiser des mini-événements. Focus: qualité et pertinence.',
    '- Très bonne écriture\n- Capacité à synthétiser\n- Expérience modération\n',
    'Expérience podcast/vidéo et formats courts.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['MEDIA','EDUCATION'],
    false,
    '[]'::jsonb,
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    0, 250000, 'XOF', 'PROJECT',
    'REMOTE',
    '[{"country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '15 days',
    CURRENT_DATE + 14,
    INTERVAL '2 months',
    'OPEN',
    'Goût pour l''entraide et la pédagogie. Discipline éditoriale.'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Stage: Assistant Ops (Spaces & réservations)',
    'stage-ops-spaces',
    'INTERNSHIP','INTERNSHIP','FULL_TIME',
    'Support sur la gestion des espaces: planning, demandes, suivi qualité, retours clients. Missions terrain New York.',
    '- Organisation\n- Rigueur\n- Sens du service\n',
    'Excel/Sheets.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['SERVICES','TECH'],
    false,
    '[]'::jsonb,
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    100000, 200000, 'XOF', 'MONTHLY',
    'ON_SITE',
    '[{"city":"New York","region":"New York","country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '12 days',
    CURRENT_DATE + 7,
    INTERVAL '3 months',
    'OPEN',
    'Profil terrain, fiable, orienté clients.'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'UX/UI Designer (Mobile) - Design system & accessibilité',
    'ux-ui-designer-mobile',
    'EMPLOYMENT','CDD','FULL_TIME',
    'Refondre des écrans clés (onboarding, candidatures, communautés) et consolider un design system. Priorité: clarté et accessibilité.',
    '- Maîtrise Figma\n- Wireframes -> prototypes\n- Sens produit\n',
    'Expérience design system + recherche utilisateur.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['TECH','MEDIA'],
    false,
    '[{"id":"q1","question":"Montre 1 étude de cas (problème -> solution -> résultat).","required":true}]'::jsonb,
    'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    400000, 900000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"New York","country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '16 days',
    CURRENT_DATE + 21,
    INTERVAL '4 months',
    'OPEN',
    'Capable de justifier ses choix (accessibilité, hiérarchie, texte).'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'Consultant DevOps (CI/CD & Observabilité)',
    'consultant-devops-cicd',
    'FREELANCE','SERVICE','FLEXIBLE',
    'Stabiliser les déploiements, améliorer logs/metrics, et réduire le temps de diagnostic. Mission courte, orientée résultats.',
    '- Docker\n- CI/CD\n- Monitoring (logs, métriques)\n',
    'Bonus: PostgreSQL tuning.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['TECH'],
    false,
    '[]'::jsonb,
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    0, 600000, 'XOF', 'PROJECT',
    'REMOTE',
    '[{"country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '10 days',
    CURRENT_DATE + 10,
    INTERVAL '1 month',
    'OPEN',
    'Autonome, documente et priorise les gains rapides.'
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    'Formateur(trice) Excel (ateliers employabilité)',
    'formateur-excel-ateliers',
    'VOLUNTEER','SERVICE','OCCASIONAL',
    'Animer 3 ateliers (2h) sur Excel: tableaux, KPI simples, CV/portfolio (présentation). Public: étudiants et jeunes actifs.',
    '- Pédagogie\n- Exemples concrets\n- Animation\n',
    'Bonus: templates et exercices.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['EDUCATION','SERVICES'],
    false,
    '[]'::jsonb,
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    0, 0, 'XOF', 'PROJECT',
    'ON_SITE',
    '[{"city":"New York","region":"New York","country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '6 days',
    NOW() + INTERVAL '20 days',
    CURRENT_DATE + 14,
    INTERVAL '1 month',
    'OPEN',
    'Profil orienté pratique, empathique, fiable.'
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    'Chargé(e) de Programme - Employabilité & impact',
    'charge-programme-employabilite',
    'EMPLOYMENT','CDD','FULL_TIME',
    'Structurer un programme (cohortes, suivi, partenariats) et produire un reporting clair. Coordination terrain + digital.',
    '- Organisation\n- Communication\n- Suivi-évaluation\n',
    'Bonus: expérience ONG/incubation.',
    '10000000-0000-4000-8000-000000000001',
    ARRAY['SERVICES','EDUCATION'],
    false,
    '[]'::jsonb,
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop'],
    '[]'::jsonb,
    350000, 750000, 'XOF', 'MONTHLY',
    'HYBRID',
    '[{"city":"New York","country":"US","is_primary":true}]'::jsonb,
    'PUBLIC',
    NOW() - INTERVAL '1 days',
    NOW() + INTERVAL '23 days',
    CURRENT_DATE + 30,
    INTERVAL '6 months',
    'OPEN',
    'Orienté impact: capacité à mesurer, apprendre, itérer.'
  );

INSERT INTO opportunity_posters (opportunity_id, poster_organization_id, role)
VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','POSTER'),
  ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','POSTER');

-- Applications: realistic distribution + statuses
INSERT INTO opportunity_applications (id, talent_id, opportunity_id, status, cover_letter, custom_answers, star_rating, viewed_at)
VALUES
  -- Fullstack
  ('20000000-0000-4000-8000-000000001001','90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','IN_REVIEW','Je suis partante pour construire vite et propre. Expérience React/Node/Postgres sur des produits B2C.','[{"question_id":"q1","question":"Projet","answer":"Plateforme d''apprentissage: +22% activation en 8 semaines."},{"question_id":"q2","question":"Stack","answer":"React + TS + Postgres, car vitesse et robustesse."}]'::jsonb,5,NOW()-INTERVAL '1 day'),
  ('20000000-0000-4000-8000-000000001002','90000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','SUBMITTED','Je suis backend TS. Je peux prendre en charge auth, migrations, et performance API.','[{"question_id":"q1","question":"Projet","answer":"API paiement + RBAC, réduction erreurs prod."},{"question_id":"q2","question":"Stack","answer":"Node/TS + Postgres + tests."}]'::jsonb,4,NULL),
  ('20000000-0000-4000-8000-000000001003','90000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','SUBMITTED','DevOps, je postule si besoin infra/CI/CD et qualité release.','[{"question_id":"q1","question":"Projet","answer":"Mise en place CI/CD + observabilité."},{"question_id":"q2","question":"Stack","answer":"Docker, GitHub Actions, Linux."}]'::jsonb,3,NULL),

  -- Data analyst
  ('20000000-0000-4000-8000-000000001011','90000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','ACCEPTED','Je peux cadrer KPI, construire des dashboards, et former l''équipe à l''usage.','[{"question_id":"q1","question":"KPI","answer":"Partir des décisions, puis métriques actionnables, puis instrumentation."}]'::jsonb,5,NOW()-INTERVAL '2 days'),
  ('20000000-0000-4000-8000-000000001012','90000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000002','SUBMITTED','Je suis profil santé/data, motivée pour apprendre SQL et reporting.','[{"question_id":"q1","question":"KPI","answer":"Je pars des objectifs programme et des résultats mesurables."}]'::jsonb,3,NULL),

  -- Community manager
  ('20000000-0000-4000-8000-000000001021','90000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000003','IN_REVIEW','J''anime déjà des communautés tech. Je propose un calendrier éditorial et des rituels.','[]'::jsonb,4,NOW()-INTERVAL '3 days'),
  ('20000000-0000-4000-8000-000000001022','90000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','SUBMITTED','Je peux couvrir acquisition contenu + partenariats + modération.','[]'::jsonb,3,NULL),

  -- Ops internship
  ('20000000-0000-4000-8000-000000001031','90000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','IN_REVIEW','Je suis rigoureux, terrain et je sais faire du suivi.','[]'::jsonb,4,NOW()-INTERVAL '1 day'),
  ('20000000-0000-4000-8000-000000001032','90000000-0000-4000-8000-000000000019','20000000-0000-4000-8000-000000000004','SUBMITTED','Profil opérations/logistique, je veux passer côté produit/service.','[]'::jsonb,3,NULL),

  -- UX/UI
  ('20000000-0000-4000-8000-000000001041','90000000-0000-4000-8000-000000000018','20000000-0000-4000-8000-000000000005','IN_REVIEW','Je peux structurer un design system et mener des tests rapides.','[{"question_id":"q1","question":"Case study","answer":"Refonte onboarding: baisse drop-off de 18% (prototype + itérations)."}]'::jsonb,5,NOW()-INTERVAL '1 day'),
  ('20000000-0000-4000-8000-000000001042','90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','SUBMITTED','Je collabore bien avec design. Je peux aussi prototyper vite en React.','[{"question_id":"q1","question":"Case study","answer":"Design -> dev: réduction de bugs UI et retours utilisateurs positifs."}]'::jsonb,4,NULL),

  -- DevOps
  ('20000000-0000-4000-8000-000000001051','90000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000006','ACCEPTED','Je propose un plan 2 semaines: CI/CD + logs structurés + alerting.','[]'::jsonb,5,NOW()-INTERVAL '2 days'),
  ('20000000-0000-4000-8000-000000001052','90000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','IN_REVIEW','Je peux aider sur sécurité, scripts de migrations, et tuning Postgres.','[]'::jsonb,4,NOW()-INTERVAL '1 day'),

  -- Trainer
  ('20000000-0000-4000-8000-000000001061','90000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000007','ACCEPTED','Je peux animer des ateliers Excel très pratiques, avec exercices et fichiers.','[]'::jsonb,5,NOW()-INTERVAL '3 days'),
  ('20000000-0000-4000-8000-000000001062','90000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000007','IN_REVIEW','Je peux co-animer CV + entretien, et compléter avec suivi individuel.','[]'::jsonb,4,NOW()-INTERVAL '2 days'),

  -- Program
  ('20000000-0000-4000-8000-000000001071','90000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000008','IN_REVIEW','Je sais cadrer un programme, faire du suivi-évaluation, et animer des partenaires.','[]'::jsonb,5,NOW()-INTERVAL '1 day'),
  ('20000000-0000-4000-8000-000000001072','90000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000008','SUBMITTED','Je peux mettre en place un process de suivi des bénéficiaires et de reporting.','[]'::jsonb,4,NULL);

-- Messages inside one application thread (simulate recruiter chat)
INSERT INTO application_messages (id, application_id, sender_type, sender_id, content, proposed_datetime, datetime_type, is_read)
VALUES
  ('20000000-0000-4000-8000-000000002001','20000000-0000-4000-8000-000000001001','organization','10000000-0000-4000-8000-000000000001','Merci Aminata. Peux-tu partager 1 repo public et ton dispo pour un échange 20 min ?', NOW() + INTERVAL '2 days', 'CALL', true),
  ('20000000-0000-4000-8000-000000002002','20000000-0000-4000-8000-000000001001','talent','90000000-0000-4000-8000-000000000002','Oui. Dispo mardi 10h ou mercredi 16h. Repo: github.com/demo/aminata-portfolio', NULL, NULL, true);

-- ---------------------------------------------------------------------
-- 7) Spaces + bookings (reservations)
-- ---------------------------------------------------------------------

INSERT INTO spaces (
  id, name, slug, description,
  type, surface_m2, capacity, floor_number,
  address, city, region, country,
  equipment, amenities, sectors,
  is_accessible, accessibility_features, accessibility_notes,
  cover_image_url, gallery_images,
  hourly_rate, daily_rate, weekly_rate, monthly_rate,
  deposit_amount,
  is_bookable, min_booking_hours, max_booking_hours,
  visibility, booking_rules, requires_approval,
  contact_name, contact_phone, contact_email,
  organization_id, created_by, status
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    'Salle Formation Plateau',
    'salle-formation-plateau',
    'Salle équipée pour formation (vidéoprojecteur, tableau blanc). Idéale pour ateliers CV, data, orientation.',
    'SALLE_FORMATION',
    78.0, 24, 2,
    'Plateau, Avenue Chardy (proche transports)',
    'New York','New York','US',
    ARRAY['VIDEOPROJECTOR','WHITEBOARD','SCREEN','SOUND_SYSTEM','MICROPHONE'],
    ARRAY['WIFI','AIR_CONDITIONING','PARKING','RECEPTION','RESTROOMS','SECURITY','NATURAL_LIGHT'],
    ARRAY['EDUCATION','TECH'],
    true,
    ARRAY['WHEELCHAIR_ACCESS','ACCESSIBLE_RESTROOM','WIDE_DOORS'],
    'Accès par rampe; toilettes accessibles.',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop'],
    15000, 90000, 450000, 1200000,
    30000,
    true, 2, 12,
    'PUBLIC',
    ARRAY['Respect du matériel','Arriver 10 min avant','Finir et ranger la salle'],
    false,
    'Etudesk SAS', '+2250574631148', 'etudesksas@gmail.com',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Studio Podcast & Vidéo',
    'studio-podcast-video',
    'Studio compact pour captation (podcast, interviews, mini-cours).',
    'STUDIO',
    22.0, 6, 0,
    'Cocody Angré, accès facile',
    'New York','New York','US',
    ARRAY['SOUND_SYSTEM','MICROPHONE','WEBCAM','TV_SCREEN','VIDEO_CONFERENCE'],
    ARRAY['WIFI','AIR_CONDITIONING','SECURITY','SOUNDPROOF','RECEPTION'],
    ARRAY['MEDIA','EDUCATION','TECH'],
    true,
    ARRAY['WHEELCHAIR_ACCESS','WIDE_DOORS'],
    'Accès plain-pied.',
    'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=400&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=400&fit=crop'],
    25000, 140000, 700000, 1800000,
    50000,
    true, 1, 8,
    'PUBLIC',
    ARRAY['Pas de nourriture dans la salle','Respect horaires'],
    true,
    'Etudesk SAS', '+2250574631148', 'etudesksas@gmail.com',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'ACTIVE'
  );

-- Bookings (confirmed + completed)
INSERT INTO space_bookings (
  id, space_id, organization_id, talent_id,
  start_datetime, end_datetime,
  purpose, attendees_count,
  pricing_type, unit_price, units_count, subtotal, deposit_amount, total_amount,
  payment_status, payment_method, payment_reference, paid_at,
  status, confirmed_at, confirmed_by, completed_at,
  rating, review
) VALUES
  (
    '30000000-0000-4000-8000-000000001001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000009',
    NOW() + INTERVAL '3 days 09 hours',
    NOW() + INTERVAL '3 days 13 hours',
    'Atelier CV + simulation entretien (groupe 12)',
    12,
    'HOURLY', 15000, 4, 60000, 30000, 90000,
    'PAID', 'CASH', 'CASH-SEED-0001', NOW() - INTERVAL '1 hour',
    'CONFIRMED', NOW() - INTERVAL '1 hour', '90000000-0000-4000-8000-000000000001', NULL,
    NULL, NULL
  ),
  (
    '30000000-0000-4000-8000-000000001002',
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000011',
    NOW() - INTERVAL '2 days 10 hours',
    NOW() - INTERVAL '2 days 08 hours',
    'Enregistrement 3 épisodes (orientation + emploi)',
    4,
    'HOURLY', 25000, 2, 50000, 50000, 100000,
    'PAID', 'CASH', 'CASH-SEED-0002', NOW() - INTERVAL '3 days',
    'COMPLETED', NOW() - INTERVAL '3 days', '90000000-0000-4000-8000-000000000001', NOW() - INTERVAL '2 days 07 hours',
    5, 'Studio propre, son correct, équipe réactive.'
  ),
  (
    '30000000-0000-4000-8000-000000001003',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000005',
    NOW() + INTERVAL '1 days 14 hours',
    NOW() + INTERVAL '1 days 16 hours',
    'Session dashboards KPI (Power BI) - groupe 8',
    8,
    'HOURLY', 15000, 2, 30000, 30000, 60000,
    'PENDING', 'CASH', NULL, NULL,
    'PENDING', NULL, NULL, NULL,
    NULL, NULL
  ),
  (
    '30000000-0000-4000-8000-000000001004',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000016',
    NOW() + INTERVAL '9 days 09 hours',
    NOW() + INTERVAL '9 days 17 hours',
    'Atelier Excel (KPI employabilité) - journée',
    20,
    'DAILY', 90000, 1, 90000, 30000, 120000,
    'PAID', 'CASH', 'CASH-SEED-0004', NOW() - INTERVAL '2 hours',
    'CONFIRMED', NOW() - INTERVAL '2 hours', '90000000-0000-4000-8000-000000000001', NULL,
    NULL, NULL
  ),
  (
    '30000000-0000-4000-8000-000000001005',
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000004',
    NOW() + INTERVAL '6 days 18 hours',
    NOW() + INTERVAL '6 days 20 hours',
    'Capsules vidéo: marketing & acquisition (2 épisodes)',
    3,
    'HOURLY', 25000, 2, 50000, 50000, 100000,
    'PAID', 'CASH', 'CASH-SEED-0005', NOW() - INTERVAL '1 day',
    'CONFIRMED', NOW() - INTERVAL '1 day', '90000000-0000-4000-8000-000000000001', NULL,
    NULL, NULL
  ),
  (
    '30000000-0000-4000-8000-000000001006',
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '6 days 16 hours',
    NOW() - INTERVAL '6 days 14 hours',
    'Enregistrement annonce produit (Etudesk OS)',
    2,
    'HOURLY', 25000, 2, 50000, 50000, 100000,
    'PAID', 'CASH', 'CASH-SEED-0006', NOW() - INTERVAL '7 days',
    'COMPLETED', NOW() - INTERVAL '7 days', '90000000-0000-4000-8000-000000000001', NOW() - INTERVAL '6 days 13 hours',
    5, 'Très bon rendu, rapide.'
  ),
  (
    '30000000-0000-4000-8000-000000001007',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000007',
    NOW() + INTERVAL '4 days 10 hours',
    NOW() + INTERVAL '4 days 13 hours',
    'Atelier onboarding (process RH) - équipe 10',
    10,
    'HOURLY', 15000, 3, 45000, 30000, 75000,
    'PAID', 'CASH', 'CASH-SEED-0007', NOW() - INTERVAL '30 minutes',
    'CONFIRMED', NOW() - INTERVAL '30 minutes', '90000000-0000-4000-8000-000000000001', NULL,
    NULL, NULL
  ),
  (
    '30000000-0000-4000-8000-000000001008',
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000018',
    NOW() + INTERVAL '1 days 11 hours',
    NOW() + INTERVAL '1 days 12 hours',
    'Interview utilisateur (prototype mobile)',
    2,
    'HOURLY', 25000, 1, 25000, 50000, 75000,
    'PENDING', 'CASH', NULL, NULL,
    'PENDING', NULL, NULL, NULL,
    NULL, NULL
  );

-- ---------------------------------------------------------------------
-- 8) Minimal preferences (optional but useful in UI)
-- ---------------------------------------------------------------------

INSERT INTO notification_preferences (talent_id)
SELECT t.id FROM talents t
WHERE t.id::text LIKE '90000000-0000-4000-8000-%'
ON CONFLICT (talent_id) DO NOTHING;

COMMIT;
