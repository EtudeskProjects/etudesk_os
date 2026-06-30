/**
 * Seed Demo — rich, realistic demo dataset wired ONLY to the digital skills
 * referential (catalog). Seeds the demo account + its organization with talents,
 * opportunities, communities (posts / poll / comments / reactions), spaces,
 * applications, memberships and bookings.
 *
 * - Every skill (talent, opportunity, community, space) is resolved to a catalog
 *   slug via catalog.service. Non-catalog labels are skipped (logged).
 * - Idempotent: upserts by stable slugs; child content is scope-deleted per demo
 *   entity then re-inserted.
 * - No embeddings / pgvector seed. Run AFTER migrations + seed:competencies:
 *     npx tsx src/scripts/seed-demo.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { pool } from '../services/database';
import { v4 as uuidv4 } from 'uuid';
import { resolveLabel, getCatalogVersion } from '../services/skills/catalog.service';
import { LEVEL_SCORE, FRAMEWORK_VERSION, type Level } from '../constants/skills';
import {
  validateFromOpportunity,
  validateFromCommunity,
  validateFromSpace,
} from '../services/skills/skill-validation.service';

const ORG_SLUG = 'etudesk-demo-org';
const DEMO_EMAIL = 'etd-app-review@etudesk.com';

const SEED_DOC_FIXTURES: Record<string, string> = {
  'seed-ops-cv.txt': `CV operateur produit

Profil: fondateur et operateur produit, specialise dans les plateformes de developpement de talents, les communautes numeriques et les workflows data.

Forces principales:
- Product Management: cadrage produit, priorisation, roadmap, coordination execution.
- Data Analytics: lecture de funnels, KPI, tableaux de bord et decisions basees sur les donnees.
- Leadership et communication: animation d'equipes, restitution claire, prise de parole.
- SQL: exploration de donnees operationnelles et analyse de performance.

Experience recente:
- Construction d'une plateforme qui relie profils, competences, communautes, opportunites et espaces de travail.
- Mise en place de workflows copilote pour explorer des opportunites, generer des documents et aider les organisations a piloter leur vivier.
- Coordination produit entre besoins utilisateurs, donnees operationnelles et automatisation IA.
`,
  'seed-ops-portfolio.txt': `Portfolio Etudesk OS

Cas 1: communaute numerique
Objectif: aider les talents a apprendre, partager des ressources et rejoindre des groupes utiles.
Actions: modelisation des communautes, activites, polls, events, commentaires et moderation.
Impact attendu: meilleure activation des membres et plus de signaux de competences observes.

Cas 2: recrutement et vivier
Objectif: aider les organisations a comprendre les candidatures, profils et besoins de recrutement.
Actions: structuration des opportunites, candidatures, membres, documents et analytics.
Impact attendu: decisions plus rapides et meilleurs matching entre besoins et competences.

Cas 3: apprentissage assiste
Objectif: accompagner les talents dans leur progression sur les competences numeriques.
Actions: copilote d'etude, generation de quiz, parcours, schemas et suivi des competences.
`,
  'seed-ops-cert-data.txt': `Certificat Data Analytics

Parcours court oriente analyse de donnees operationnelles.

Modules couverts:
- SQL pour selectionner, filtrer, agreger et comparer des donnees.
- Construction de KPI: taux de conversion, volume, evolution, segmentation.
- Dashboarding: choix des visualisations, tableaux de bord simples, lecture actionnable.
- Qualite de donnees: valeurs manquantes, doublons, coherence des definitions.

Projet final:
Analyser un funnel de candidatures, identifier les points de blocage et recommander trois actions prioritaires.
`,
};

let CATALOG_VERSION = '2026-Q2';

async function resolveSlugs(labels: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const l of labels) {
    const r = await resolveLabel(l);
    if (r) out.push(r.slug);
    else console.warn(`  [skip] no catalog match for "${l}"`);
  }
  return [...new Set(out)];
}

async function addSkills(
  talentId: string,
  skills: Array<[string, Level]>,
  origin: 'declared' | 'extracted' = 'declared'
): Promise<void> {
  for (const [label, level] of skills) {
    const r = await resolveLabel(label);
    if (!r) {
      console.warn(`  [skip skill] "${label}"`);
      continue;
    }
    await pool.query(
      `INSERT INTO talent_skills (talent_id, competency_slug, level, score, origin, catalog_version, framework_version, last_evidence_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (talent_id, competency_slug) DO UPDATE SET level = EXCLUDED.level, score = EXCLUDED.score`,
      [talentId, r.slug, level, LEVEL_SCORE[level] || 1, origin, CATALOG_VERSION, FRAMEWORK_VERSION]
    );
  }
}

async function upsertTalent(t: {
  slug: string; first: string; last: string; email: string; city: string;
  tags: string[]; sectors: string[]; bio: string;
}): Promise<{ talentId: string; userId: string }> {
  await pool.query(
    `INSERT INTO talents (id, slug, first_name, last_name, email, city, country, sectors, profile_tags, bio, remote_ready, is_visible)
     VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,'US',$6,$7,$8,true,true)
     ON CONFLICT (slug) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, bio=EXCLUDED.bio`,
    [t.slug, t.first, t.last, t.email, t.city, t.sectors, t.tags, t.bio]
  );
  const tr = await pool.query(`SELECT id FROM talents WHERE slug=$1`, [t.slug]);
  const talentId = tr.rows[0].id;
  await pool.query(
    `INSERT INTO users (id, email, email_verified, talent_id)
     SELECT uuid_generate_v4(), $1::varchar, true, $2::uuid
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE email=$1::varchar AND deleted_at IS NULL)`,
    [t.email, talentId]
  );
  const ur = await pool.query(`SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL`, [t.email]);
  return { talentId, userId: ur.rows[0].id };
}

async function main() {
  CATALOG_VERSION = await getCatalogVersion();
  console.log(`[seed-demo] catalog ${CATALOG_VERSION}`);

  // --- Organization ---
  await pool.query(
    `INSERT INTO organizations (id, name, slug, types, sectors, description, headquarters_city, headquarters_country, is_visible, verification_status)
     VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,'New York','US',true,'VERIFIED')
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, sectors=EXCLUDED.sectors, description=EXCLUDED.description`,
    ['Etudesk Demo Org', ORG_SLUG, ['STARTUP'], ['DIGITAL', 'EDUCATION'], "Studio EdTech & data/IA basé à New York — démonstration."]
  );
  const orgId = (await pool.query(`SELECT id FROM organizations WHERE slug=$1`, [ORG_SLUG])).rows[0].id;

  // --- Primary demo user (realistic operational account) ---
  const primaryDemo = await upsertTalent({
    slug: 'app-review',
    first: 'Lamine',
    last: 'Barro',
    email: DEMO_EMAIL,
    city: 'New York',
    tags: ['ENTREPRENEUR', 'MANAGER'],
    sectors: ['DIGITAL', 'EDUCATION'],
    bio: 'Founder/operator building Etudesk OS. Product, data, communities, hiring and learning operations.',
  });
  await addSkills(primaryDemo.talentId, [
    ['Product Management', 'advanced'],
    ['Leadership', 'advanced'],
    ['Project Management', 'advanced'],
    ['Public Speaking', 'intermediate'],
    ['AI Governance', 'intermediate'],
    ['Communication', 'advanced'],
    ['Data Analytics', 'intermediate'],
    ['SQL', 'intermediate'],
  ]);
  await pool.query(
    `INSERT INTO talent_credit_wallets (talent_id, balance_credits, updated_at)
     VALUES ($1, 100, NOW())
     ON CONFLICT (talent_id) DO UPDATE SET balance_credits = 100, updated_at = NOW()`,
    [primaryDemo.talentId]
  );
  console.log('  app-review operational user seeded');

  // --- Talents ---
  const talents = [
    { slug: 'demo-aminata', first: 'Aminata', last: 'Koné', email: 'demo.aminata@etudesk.dev', city: 'New York', tags: ['JOB_SEEKER'], sectors: ['DIGITAL'], bio: 'Développeuse frontend React passionnée par les produits éducatifs.', skills: [['React', 'advanced'], ['JavaScript', 'advanced'], ['Node.js', 'intermediate'], ['Communication', 'advanced']] },
    { slug: 'demo-moussa', first: 'Moussa', last: 'Traoré', email: 'demo.moussa@etudesk.dev', city: 'Bouaké', tags: ['STUDENT'], sectors: ['DIGITAL'], bio: 'Étudiant en data, féru de dashboards et de SQL.', skills: [['Python', 'intermediate'], ['Data Analytics', 'beginner'], ['SQL', 'intermediate'], ['Teamwork', 'intermediate']] },
    { slug: 'demo-fatou', first: 'Fatou', last: 'Diallo', email: 'demo.fatou@etudesk.dev', city: 'New York', tags: ['SALARIED'], sectors: ['DIGITAL'], bio: 'Product manager orientée impact et exécution.', skills: [['Project Management', 'advanced'], ['Leadership', 'advanced'], ['Figma', 'intermediate']] },
    { slug: 'demo-ibrahim', first: 'Ibrahim', last: 'Bamba', email: 'demo.ibrahim@etudesk.dev', city: 'New York', tags: ['JOB_SEEKER'], sectors: ['DIGITAL'], bio: 'Ingénieur backend Node/PostgreSQL.', skills: [['Node.js', 'advanced'], ['PostgreSQL', 'advanced'], ['Docker', 'intermediate'], ['Git', 'advanced']] },
    { slug: 'demo-awa', first: 'Awa', last: 'Sangaré', email: 'demo.awa@etudesk.dev', city: 'New York', tags: ['SALARIED'], sectors: ['DIGITAL'], bio: 'Designer produit UI/UX.', skills: [['UI Design', 'advanced'], ['UX Design', 'advanced'], ['Figma', 'advanced'], ['Prototyping', 'intermediate']] },
    { slug: 'demo-kofi', first: 'Kofi', last: 'Mensah', email: 'demo.kofi@etudesk.dev', city: 'New York', tags: ['ENTREPRENEUR'], sectors: ['MEDIA'], bio: 'Growth & contenu pour startups africaines.', skills: [['Digital Marketing', 'advanced'], ['SEO', 'intermediate'], ['Content Marketing', 'advanced'], ['Copywriting', 'intermediate']] },
    { slug: 'demo-mariam', first: 'Mariam', last: 'Cissé', email: 'demo.mariam@etudesk.dev', city: 'Yamoussoukro', tags: ['JOB_SEEKER'], sectors: ['DIGITAL'], bio: 'Data scientist (ML, visualisation).', skills: [['Machine Learning', 'intermediate'], ['Python', 'advanced'], ['Data Visualization', 'intermediate'], ['Statistics', 'intermediate']] },
    { slug: 'demo-yao', first: 'Yao', last: 'Kouassi', email: 'demo.yao@etudesk.dev', city: 'New York', tags: ['SALARIED'], sectors: ['DIGITAL'], bio: 'DevOps / cloud.', skills: [['Docker', 'advanced'], ['Kubernetes', 'intermediate'], ['Cloud Computing', 'intermediate'], ['Git', 'advanced']] },
  ];

  const talentMap: Record<string, { talentId: string; userId: string }> = {
    'app-review': primaryDemo,
  };
  for (const tt of talents) {
    const ids = await upsertTalent(tt);
    talentMap[tt.slug] = ids;
    await addSkills(ids.talentId, tt.skills as Array<[string, Level]>);
    console.log(`  talent ${tt.first} ${tt.last}`);
  }

  // --- Org memberships (a couple of talents) ---
  const memberRoles: Array<[string, string]> = [['app-review', 'OWNER'], ['demo-fatou', 'MANAGER'], ['demo-aminata', 'MEMBER'], ['demo-ibrahim', 'MEMBER']];
  for (const [slug, role] of memberRoles) {
    await pool.query(
      `INSERT INTO organization_members (organization_id, talent_id, role, status)
       SELECT $1,$2,$3,'ACTIVE'
       WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND talent_id=$2)`,
      [orgId, talentMap[slug].talentId, role]
    );
  }

  // --- Opportunities (catalog-tagged) ---
  const opps = [
    { slug: 'demo-frontend-dev', title: 'Développeur Frontend React', contract: 'CDI', summary: 'Développer les interfaces de la plateforme Etudesk.', required: ['React', 'JavaScript'], nice: ['Node.js'] },
    { slug: 'demo-data-analyst', title: 'Data Analyst Junior', contract: 'CDD', summary: 'Analyser les données produit et construire des dashboards.', required: ['Data Analytics', 'SQL'], nice: ['Python'] },
    { slug: 'demo-product-manager', title: 'Product Manager', contract: 'CDI', summary: 'Piloter la roadmap produit et coordonner les équipes.', required: ['Project Management', 'Leadership'], nice: ['Figma'] },
    { slug: 'demo-backend-eng', title: 'Ingénieur Backend Node.js', contract: 'CDI', summary: 'Concevoir et opérer les APIs de la plateforme.', required: ['Node.js', 'PostgreSQL'], nice: ['Docker'] },
    { slug: 'demo-ux-designer', title: 'UX/UI Designer', contract: 'FREELANCE', summary: 'Concevoir l’expérience et les interfaces produit.', required: ['UX Design', 'Figma'], nice: ['Prototyping'] },
  ];
  const oppIds: Record<string, string> = {};
  for (const op of opps) {
    await pool.query(
      `INSERT INTO opportunities (id, title, slug, type, contract_type, summary, sectors, location_type, locations, status, visibility, organization_id, posted_at)
       VALUES (uuid_generate_v4(),$1,$2,'JOB',$3,$4,$5,'ON_SITE',$6,'OPEN','PUBLIC',$7,NOW())
       ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, status='OPEN'`,
      [op.title, op.slug, op.contract, op.summary, ['DIGITAL'], JSON.stringify([{ city: 'New York', country: 'US' }]), orgId]
    );
    const oid = (await pool.query(`SELECT id FROM opportunities WHERE slug=$1`, [op.slug])).rows[0].id;
    oppIds[op.slug] = oid;
    await pool.query(
      `INSERT INTO opportunity_posters (id, opportunity_id, poster_organization_id, role, posted_at)
       VALUES (uuid_generate_v4(),$1,$2,'POSTER',NOW())
       ON CONFLICT (opportunity_id, poster_organization_id) DO NOTHING`,
      [oid, orgId]
    );
    await pool.query(`DELETE FROM opportunity_skills WHERE opportunity_id=$1`, [oid]);
    for (const slug of await resolveSlugs(op.required)) {
      await pool.query(`INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight) VALUES ($1,$2,'required',1.0) ON CONFLICT DO NOTHING`, [oid, slug]);
    }
    for (const slug of await resolveSlugs(op.nice)) {
      await pool.query(`INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight) VALUES ($1,$2,'nice_to_have',0.5) ON CONFLICT DO NOTHING`, [oid, slug]);
    }
    console.log(`  opportunity ${op.title}`);
  }

  // --- Applications (with statuses) ---
  const apps: Array<[string, string, string, string]> = [
    // talentSlug, oppSlug, status, coverLetter
    ['demo-aminata', 'demo-frontend-dev', 'ACCEPTED', "3 ans de React, j'adore l'EdTech."],
    ['demo-ibrahim', 'demo-backend-eng', 'IN_REVIEW', 'Node/PostgreSQL en production depuis 4 ans.'],
    ['demo-moussa', 'demo-data-analyst', 'ACCEPTED', 'Passionné de data et de SQL.'],
    ['demo-mariam', 'demo-data-analyst', 'SUBMITTED', 'Data scientist, je veux contribuer.'],
    ['demo-fatou', 'demo-product-manager', 'ACCEPTED', 'PM orientée exécution et impact.'],
    ['demo-kofi', 'demo-product-manager', 'SUBMITTED', 'Profil growth/produit.'],
    ['demo-awa', 'demo-ux-designer', 'IN_REVIEW', 'Designer UI/UX, portfolio dispo.'],
  ];
  for (const [tslug, oslug, status, cover] of apps) {
    await pool.query(
      `INSERT INTO opportunity_applications (id, talent_id, opportunity_id, status, cover_letter, applied_at)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,NOW())
       ON CONFLICT (talent_id, opportunity_id) DO UPDATE SET status=EXCLUDED.status, cover_letter=EXCLUDED.cover_letter`,
      [talentMap[tslug].talentId, oppIds[oslug], status, cover]
    );
  }
  console.log(`  ${apps.length} applications`);

  // --- Communities (catalog-tagged) + members + activities ---
  const communities = [
    { slug: 'demo-dev-community', name: 'Dev Community New York', desc: 'Communauté des développeurs web & mobile.', validates: ['Communication', 'Teamwork', 'Leadership'], topic: [], members: ['demo-aminata', 'demo-ibrahim', 'demo-yao', 'demo-moussa'] },
    { slug: 'demo-data-community', name: 'Data & IA New York', desc: 'Praticiens data science et IA.', validates: ['Teamwork'], topic: ['Machine Learning', 'Data Analytics'], members: ['demo-moussa', 'demo-mariam', 'demo-yao'] },
    { slug: 'demo-design-community', name: 'Design Produit', desc: 'Designers produit UI/UX.', validates: ['Communication'], topic: ['UI Design', 'UX Design'], members: ['demo-awa', 'demo-fatou'] },
  ];
  const commIds: Record<string, string> = {};
  for (const c of communities) {
    await pool.query(
      `INSERT INTO communities (id, name, slug, type, description, access_type, visibility, sectors, city, country, status, organization_id, created_by)
       VALUES (uuid_generate_v4(),$1,$2,'PROFESSIONAL',$3,'OPEN','PUBLIC',$4,'New York','US','ACTIVE',$5,NULL)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description`,
      [c.name, c.slug, c.desc, JSON.stringify(['DIGITAL']), orgId]
    );
    const cid = (await pool.query(`SELECT id FROM communities WHERE slug=$1`, [c.slug])).rows[0].id;
    commIds[c.slug] = cid;
    await pool.query(`DELETE FROM community_skills WHERE community_id=$1`, [cid]);
    for (const slug of await resolveSlugs(c.validates)) {
      await pool.query(`INSERT INTO community_skills (community_id, competency_slug, role) VALUES ($1,$2,'validates') ON CONFLICT DO NOTHING`, [cid, slug]);
    }
    for (const slug of await resolveSlugs(c.topic)) {
      await pool.query(`INSERT INTO community_skills (community_id, competency_slug, role) VALUES ($1,$2,'topic') ON CONFLICT DO NOTHING`, [cid, slug]);
    }
    // members
    for (const mslug of c.members) {
      await pool.query(
        `INSERT INTO community_members (id, community_id, talent_id, role, status, accepted_rules, joined_at)
         VALUES (uuid_generate_v4(),$1,$2,'MEMBER','ACTIVE',true,CURRENT_DATE)
         ON CONFLICT (talent_id, community_id) DO UPDATE SET status='ACTIVE'`,
        [cid, talentMap[mslug].talentId]
      );
    }
    console.log(`  community ${c.name} (${c.members.length} members)`);
  }

  // --- Community activities (posts / event / poll) + comments + reactions ---
  // Scope-clean previous demo content for these communities.
  const allCommIds = Object.values(commIds);
  await pool.query(
    `DELETE FROM community_activity_comments WHERE activity_id IN (SELECT id FROM community_activities WHERE community_id = ANY($1::uuid[]))`,
    [allCommIds]
  );
  await pool.query(`DELETE FROM community_activities WHERE community_id = ANY($1::uuid[])`, [allCommIds]);

  const devCid = commIds['demo-dev-community'];
  const dataCid = commIds['demo-data-community'];

  async function addActivity(communityId: string, authorTalent: string, type: 'POST' | 'EVENT' | 'POLL', content: string, metadata?: any): Promise<string> {
    const r = await pool.query(
      `INSERT INTO community_activities (id, community_id, author_id, type, content, metadata, status, moderation_status, published_at)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,'PUBLISHED','APPROVED',NOW()) RETURNING id`,
      [communityId, talentMap[authorTalent].talentId, type, content, metadata ? JSON.stringify(metadata) : null]
    );
    return r.rows[0].id;
  }
  async function addComment(activityId: string, authorTalent: string, content: string) {
    await pool.query(
      `INSERT INTO community_activity_comments (id, activity_id, author_id, content) VALUES (uuid_generate_v4(),$1,$2,$3)`,
      [activityId, talentMap[authorTalent].talentId, content]
    );
    await pool.query(`UPDATE community_activities SET comments_count = comments_count + 1 WHERE id=$1`, [activityId]);
  }
  async function addReaction(activityId: string, userTalent: string) {
    await pool.query(
      `INSERT INTO community_activity_reactions (activity_id, user_id, type) VALUES ($1,$2,'LIKE') ON CONFLICT DO NOTHING`,
      [activityId, talentMap[userTalent].talentId]
    );
    await pool.query(`UPDATE community_activities SET reactions_count = reactions_count + 1 WHERE id=$1`, [activityId]);
  }

  // Dev community: 2 posts + comments + reactions + 1 poll with votes
  const p1 = await addActivity(devCid, 'demo-aminata', 'POST', 'Quelqu’un a testé React 19 sur un projet en prod ? Retours ?');
  await addComment(p1, 'demo-ibrahim', 'Oui, les Actions simplifient pas mal les formulaires.');
  await addComment(p1, 'demo-yao', 'Attention au build, on a dû mettre à jour la CI.');
  await addReaction(p1, 'demo-ibrahim');
  await addReaction(p1, 'demo-moussa');

  const p2 = await addActivity(devCid, 'demo-ibrahim', 'POST', 'Astuce PostgreSQL : pensez aux index partiels pour les soft-deletes.');
  await addComment(p2, 'demo-aminata', 'Excellent rappel, merci !');
  await addReaction(p2, 'demo-aminata');

  const poll = await addActivity(devCid, 'demo-yao', 'POLL', 'Quel outil CI préférez-vous ?');
  const pollOptions = ['GitHub Actions', 'GitLab CI', 'CircleCI'];
  const optionIds: string[] = [];
  for (let i = 0; i < pollOptions.length; i++) {
    const or = await pool.query(
      `INSERT INTO community_poll_options (id, activity_id, text, order_index) VALUES (uuid_generate_v4(),$1,$2,$3) RETURNING id`,
      [poll, pollOptions[i], i]
    );
    optionIds.push(or.rows[0].id);
  }
  const votes: Array<[string, number]> = [['demo-aminata', 0], ['demo-ibrahim', 0], ['demo-moussa', 1], ['demo-yao', 0]];
  for (const [vslug, optIdx] of votes) {
    await pool.query(
      `INSERT INTO community_poll_votes (activity_id, option_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [poll, optionIds[optIdx], talentMap[vslug].talentId]
    );
    await pool.query(`UPDATE community_poll_options SET votes_count = votes_count + 1 WHERE id=$1`, [optionIds[optIdx]]);
  }

  // Data community: 1 post + 1 event
  const d1 = await addActivity(dataCid, 'demo-mariam', 'POST', 'Partage : un notebook sur la détection d’anomalies (scikit-learn).');
  await addComment(d1, 'demo-moussa', 'Super, je regarde ça ce week-end.');
  await addReaction(d1, 'demo-moussa');
  await addActivity(dataCid, 'demo-mariam', 'EVENT', 'Meetup Data & IA — jeudi 18h au FabLab.', { start_date: '2026-07-02T18:00:00.000Z', location: 'FabLab New York' });
  console.log('  activities (posts, poll, event, comments, reactions) seeded');

  // --- Spaces (catalog-tagged) + bookings ---
  const spaces = [
    { slug: 'demo-fablab', name: 'Atelier Fabrication Numérique', type: 'WORKSHOP', surface: 80, capacity: 20, desc: 'Prototypage et fabrication numérique.', equipment: ['Wifi', 'Imprimante 3D', 'Ordinateurs'], rate: 5000, skills: ['Prototyping', 'CAD Modeling', 'Robotics Integration'] },
    { slug: 'demo-coworking', name: 'Quiet Coworking Hub', type: 'COWORKING', surface: 200, capacity: 50, desc: 'Espace de coworking calme pour travail individuel et sessions equipe.', equipment: ['Wifi', 'Salles de réunion', 'Café'], rate: 3000, skills: ['Git', 'Docker'] },
    { slug: 'demo-media-studio', name: 'Studio Média', type: 'STUDIO', surface: 60, capacity: 10, desc: 'Studio audio/vidéo pour créateurs.', equipment: ['Caméras', 'Micros', 'Éclairage'], rate: 8000, skills: ['Video Editing', 'Photography', 'AI Image Generation'] },
  ];
  const spaceIds: Record<string, string> = {};
  for (const s of spaces) {
    await pool.query(
      `INSERT INTO spaces (id, name, slug, type, surface_m2, capacity, description, city, country, sectors, equipment, hourly_rate, is_bookable, visibility, status, organization_id)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,'New York','US',$7,$8,$9,true,'PUBLIC','ACTIVE',$10)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, hourly_rate=EXCLUDED.hourly_rate`,
      [s.name, s.slug, s.type, s.surface, s.capacity, s.desc, ['DIGITAL'], s.equipment, s.rate, orgId]
    );
    const sid = (await pool.query(`SELECT id FROM spaces WHERE slug=$1`, [s.slug])).rows[0].id;
    spaceIds[s.slug] = sid;
    await pool.query(`DELETE FROM space_skills WHERE space_id=$1`, [sid]);
    for (const slug of await resolveSlugs(s.skills)) {
      await pool.query(`INSERT INTO space_skills (space_id, competency_slug, role) VALUES ($1,$2,'validates') ON CONFLICT DO NOTHING`, [sid, slug]);
    }
    console.log(`  space ${s.name}`);
  }

  // --- Bookings (confirmed) ---
  await pool.query(`DELETE FROM space_bookings WHERE space_id = ANY($1::uuid[])`, [Object.values(spaceIds)]);
  const bookings: Array<[string, string, number]> = [
    // talentSlug, spaceSlug, hours
    ['demo-awa', 'demo-fablab', 3],
    ['demo-mariam', 'demo-fablab', 2],
    ['demo-kofi', 'demo-media-studio', 4],
    ['demo-ibrahim', 'demo-coworking', 6],
  ];
  let bookingOffsetDays = 2;
  for (const [tslug, sslug, hours] of bookings) {
    const sid = spaceIds[sslug];
    const rate = Number((await pool.query(`SELECT hourly_rate FROM spaces WHERE id=$1`, [sid])).rows[0].hourly_rate || 0);
    const subtotal = rate * hours;
    const start = new Date(Date.now() + bookingOffsetDays * 24 * 3600 * 1000);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + hours * 3600 * 1000);
    bookingOffsetDays += 1; // avoid double-booking unique index across demo bookings
    await pool.query(
      `INSERT INTO space_bookings (id, space_id, organization_id, talent_id, start_datetime, end_datetime, purpose,
         pricing_type, unit_price, units_count, subtotal, total_amount, status, confirmed_at, payment_status)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,'Session de travail','HOURLY',$6,$7,$8,$8,'CONFIRMED',NOW(),'PAID')`,
      [sid, orgId, talentMap[tslug].talentId, start.toISOString(), end.toISOString(), rate, hours, subtotal]
    );
  }
  console.log(`  ${bookings.length} bookings`);

  // --- Primary user's operational history (non-referential, realistic app state) ---
  const primaryTalentId = talentMap['app-review'].talentId;

  // Clean only deterministic seed-owned operational rows.
  await pool.query(`DELETE FROM talent_documents WHERE talent_id=$1 AND original_filename LIKE 'seed-ops-%'`, [primaryTalentId]);
  await pool.query(`DELETE FROM notifications WHERE talent_id=$1 AND data->>'seed' = 'ops-demo'`, [primaryTalentId]);
  await pool.query(`DELETE FROM agenda_triggers WHERE talent_id=$1 AND metadata->>'seed' = 'ops-demo'`, [primaryTalentId]);
  await pool.query(`DELETE FROM opportunity_bookmarks WHERE talent_id=$1`, [primaryTalentId]);
  await pool.query(`DELETE FROM community_bookmarks WHERE talent_id=$1`, [primaryTalentId]);
  await pool.query(`DELETE FROM space_bookmarks WHERE talent_id=$1`, [primaryTalentId]);
  await pool.query(
    `DELETE FROM space_bookings
     WHERE talent_id=$1 AND internal_notes='seed-ops-demo'`,
    [primaryTalentId]
  );

  // Applications across different states: what Explorer/application-tracker should see.
  const primaryApps: Array<[string, string, string]> = [
    ['demo-product-manager', 'IN_REVIEW', 'Operator/product profile. Interested in roadmap, partnerships and growth.'],
    ['demo-data-analyst', 'SUBMITTED', 'Strong SQL/product analytics background; looking for a hands-on data role.'],
    ['demo-ux-designer', 'REJECTED', 'Applied to benchmark design expectations and UX process.'],
  ];
  for (const [oslug, status, cover] of primaryApps) {
    await pool.query(
      `INSERT INTO opportunity_applications (id, talent_id, opportunity_id, status, cover_letter, applied_at, viewed_at, internal_notes)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day','seed-ops-demo')
       ON CONFLICT (talent_id, opportunity_id)
       DO UPDATE SET status=EXCLUDED.status, cover_letter=EXCLUDED.cover_letter, viewed_at=EXCLUDED.viewed_at, internal_notes=EXCLUDED.internal_notes`,
      [primaryTalentId, oppIds[oslug], status, cover]
    );
  }

  // Memberships: user has joined communities and should see real feed/news.
  const primaryCommunities: Array<[string, string]> = [
    ['demo-dev-community', 'ADMIN'],
    ['demo-data-community', 'MEMBER'],
    ['demo-design-community', 'MEMBER'],
  ];
  for (const [cslug, role] of primaryCommunities) {
    await pool.query(
      `INSERT INTO community_members (id, community_id, talent_id, role, status, accepted_rules, joined_at)
       VALUES (uuid_generate_v4(),$1,$2,$3,'ACTIVE',true,NOW() - INTERVAL '21 days')
       ON CONFLICT (talent_id, community_id)
       DO UPDATE SET role=EXCLUDED.role, status='ACTIVE', accepted_rules=true`,
      [commIds[cslug], primaryTalentId, role]
    );
  }

  // User-authored community activity + comments/reactions/bookmark.
  const primaryPost = await addActivity(
    devCid,
    'app-review',
    'POST',
    'Cette semaine je cherche des retours sur les meilleurs workflows pour connecter profils, compétences et opportunités.'
  );
  await addComment(primaryPost, 'demo-aminata', 'On pourrait tester un template de fiche de poste relié aux compétences requises.');
  await addComment(primaryPost, 'demo-mariam', 'Côté data, un dashboard gaps de compétences aiderait beaucoup.');
  await addReaction(primaryPost, 'demo-ibrahim');
  await pool.query(
    `INSERT INTO community_activity_bookmarks (activity_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [d1, primaryTalentId]
  );

  // Bookmarks across all supported entity families.
  await pool.query(
    `INSERT INTO opportunity_bookmarks (talent_id, opportunity_id, notes)
     VALUES ($1,$2,'Prioritaire: bon fit product/data'), ($1,$3,'À comparer avec profil analytics')
     ON CONFLICT (talent_id, opportunity_id) DO UPDATE SET notes=EXCLUDED.notes`,
    [primaryTalentId, oppIds['demo-product-manager'], oppIds['demo-data-analyst']]
  );
  await pool.query(
    `INSERT INTO community_bookmarks (talent_id, community_id, notes)
     VALUES ($1,$2,'Communauté stratégique pour animation tech'), ($1,$3,'Source de veille data/IA')
     ON CONFLICT (talent_id, community_id) DO UPDATE SET notes=EXCLUDED.notes`,
    [primaryTalentId, commIds['demo-dev-community'], commIds['demo-data-community']]
  );
  await pool.query(
    `INSERT INTO space_bookmarks (talent_id, space_id, notes)
     VALUES ($1,$2,'Espace idéal pour ateliers produit'), ($1,$3,'Bon pour enregistrement contenus')
     ON CONFLICT (talent_id, space_id) DO UPDATE SET notes=EXCLUDED.notes`,
    [primaryTalentId, spaceIds['demo-coworking'], spaceIds['demo-media-studio']]
  );

  // Upcoming reservation and agenda triggers: what Calendar/recap should see.
  const primaryBookingStart = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  primaryBookingStart.setHours(14, 0, 0, 0);
  const primaryBookingEnd = new Date(primaryBookingStart.getTime() + 2 * 3600 * 1000);
  const primaryRate = Number((await pool.query(`SELECT hourly_rate FROM spaces WHERE id=$1`, [spaceIds['demo-coworking']])).rows[0].hourly_rate || 0);
  await pool.query(
    `INSERT INTO space_bookings (id, space_id, organization_id, talent_id, start_datetime, end_datetime, purpose,
       pricing_type, unit_price, units_count, subtotal, total_amount, status, confirmed_at, payment_status, internal_notes)
     VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,'Atelier stratégie produit','HOURLY',$6,2,$7,$7,'CONFIRMED',NOW(),'PAID','seed-ops-demo')`,
    [spaceIds['demo-coworking'], orgId, primaryTalentId, primaryBookingStart.toISOString(), primaryBookingEnd.toISOString(), primaryRate, primaryRate * 2]
  );

  const triggerRows: Array<[string, string, string, number, string, any]> = [
    ['FOLLOW_UP_PM', 'Relancer candidature Product Manager', 'Envoyer un message de suivi personnalisé.', 2, 'HIGH', { entity_type: 'opportunity', entity_id: oppIds['demo-product-manager'] }],
    ['COMMUNITY_RECAP', 'Publier le recap Tech & Data', 'Synthétiser les discussions de la semaine.', 4, 'NORMAL', { entity_type: 'community', entity_id: commIds['demo-dev-community'] }],
    ['PORTFOLIO_REFRESH', 'Mettre à jour portfolio produit', 'Ajouter cas d’usage Etudesk OS et métriques.', 9, 'NORMAL', { entity_type: 'document', entity_id: null }],
  ];
  for (const [code, title, description, days, priority, metadata] of triggerRows) {
    await pool.query(
      `INSERT INTO agenda_triggers (scope, talent_id, code, title, description, due_at, priority, metadata, created_by)
       VALUES ('TALENT',$1,$2,$3,$4,NOW() + ($5 || ' days')::interval,$6,$7,$1)`,
      [primaryTalentId, code, title, description, days, priority, JSON.stringify({ ...metadata, seed: 'ops-demo' })]
    );
  }

  // Documents: local text fixtures so file_reader can read them during audits.
  const seedDir = path.resolve(process.cwd(), 'uploads/seed');
  await fs.mkdir(seedDir, { recursive: true });
  for (const [filename, content] of Object.entries(SEED_DOC_FIXTURES)) {
    await fs.writeFile(path.join(seedDir, filename), content, 'utf8');
  }

  const docs = [
    ['seed-ops-cv.txt', 'CV', 'PROFESSIONAL', 'CV opérateur produit', 'Résumé product/data/communities, dernières missions et compétences clés.', ['Product Management', 'SQL', 'Leadership']],
    ['seed-ops-portfolio.txt', 'PORTFOLIO', 'PROFESSIONAL', 'Portfolio Etudesk OS', 'Cas produit: communauté, recrutement et apprentissage assistés par IA.', ['Product Management', 'Data Analytics']],
    ['seed-ops-cert-data.txt', 'CERTIFICATE', 'ACADEMIC', 'Certificat Data Analytics', 'Certificat court orienté SQL, métriques et dashboarding.', ['SQL', 'Data Analytics']],
  ];
  for (const [filename, type, category, title, description, tags] of docs) {
    await pool.query(
      `INSERT INTO talent_documents (talent_id, original_filename, stored_filename, mime_type, file_size, file_url,
        document_type, category, status, processed_at, tags, title, description, is_public)
       VALUES ($1,$2::varchar,$2::varchar,'text/plain',20480,'/uploads/seed/' || $2::text,$3::document_type,$4::document_category,'PROCESSED',NOW(),$5,$6,$7,true)`,
      [primaryTalentId, filename, type, category, tags, title, description]
    );
  }

  // Notifications: unread + read, with references the agent can reason about.
  const notifications = [
    ['APPLICATION_STATUS_CHANGED', 'Candidature en revue', 'Votre candidature Product Manager est passée en revue.', 'opportunity', oppIds['demo-product-manager'], false],
    ['NEW_ACTIVITY', 'Nouveau commentaire dans Dev Community', 'Aminata a répondu à votre discussion workflow compétences.', 'community_activity', primaryPost, false],
    ['BOOKING_REMINDER', 'Réservation à venir', 'Atelier stratégie produit dans 5 jours.', 'space_booking', null, false],
    ['SYSTEM', 'Profil à rafraîchir', 'Votre portfolio produit date de plus de 30 jours.', 'document', null, true],
  ];
  for (const [type, title, body, refType, refId, isRead] of notifications) {
    await pool.query(
      `INSERT INTO notifications (talent_id, type, title, body, reference_type, reference_id, data, is_read, read_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8 THEN NOW() ELSE NULL END)`,
      [primaryTalentId, type, title, body, refType, refId, JSON.stringify({ seed: 'ops-demo' }), isRead]
    );
  }

  console.log('  primary user operations seeded (apps, memberships, bookmarks, docs, agenda, notifications)');

  // --- Participation validation (showcase origin='validated') ---
  // Accepted applications -> validate the opportunity's skills.
  for (const [tslug, oslug, status] of apps) {
    if (status === 'ACCEPTED') await validateFromOpportunity(talentMap[tslug].talentId, oppIds[oslug]);
  }
  // Community memberships -> validate soft skills.
  for (const c of communities) {
    for (const mslug of c.members) await validateFromCommunity(talentMap[mslug].talentId, commIds[c.slug]);
  }
  // Confirmed bookings -> validate space hard skills.
  for (const [tslug, sslug] of bookings) {
    await validateFromSpace(talentMap[tslug].talentId, spaceIds[sslug]);
  }
  console.log('  participation validation applied (origin=validated)');

  // --- Summary ---
  const counts = await pool.query(`SELECT
     (SELECT count(*) FROM talents WHERE slug LIKE 'demo-%' OR slug='app-review') talents,
     (SELECT count(*) FROM talent_skills) skills,
     (SELECT count(*) FROM opportunities WHERE slug LIKE 'demo-%') opps,
     (SELECT count(*) FROM opportunity_applications) applications,
     (SELECT count(*) FROM communities WHERE slug LIKE 'demo-%') communities,
     (SELECT count(*) FROM community_activities) activities,
     (SELECT count(*) FROM community_activity_comments) comments,
     (SELECT count(*) FROM spaces WHERE slug LIKE 'demo-%') spaces,
     (SELECT count(*) FROM space_bookings) bookings`);
  console.log('[seed-demo] ✅ done', counts.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error('[seed-demo] ❌', err);
  process.exit(1);
});
