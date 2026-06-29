/**
 * Seed Minimal — small, dependency-free demo dataset to test the skills referential
 * end-to-end (talent skills, opportunity/community/space skill tags, matching).
 *
 * - No embeddings / pgvector seed (safe to run without API keys).
 * - Idempotent (ON CONFLICT on slugs/emails).
 * - All skills are resolved to catalog slugs via catalog.service (real flow).
 *
 * Run AFTER migrations + seed:competencies:
 *   npx tsx src/scripts/seed-minimal.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../services/database';
import { v4 as uuidv4 } from 'uuid';
import { resolveLabel, getCatalogVersion } from '../services/skills/catalog.service';
import { LEVEL_SCORE, FRAMEWORK_VERSION, type Level } from '../constants/skills';

async function resolveSlugs(labels: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const l of labels) {
    const r = await resolveLabel(l);
    if (r) out.push(r.slug);
    else console.warn(`  [skip] no catalog match for "${l}"`);
  }
  return [...new Set(out)];
}

async function main() {
  const catalogVersion = await getCatalogVersion();
  console.log(`[seed-minimal] catalog ${catalogVersion}`);

  // --- Organization ---
  const orgId = uuidv4();
  await pool.query(
    `INSERT INTO organizations (id, name, slug, types, sectors, description, headquarters_city, headquarters_country, is_visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [orgId, 'Etudesk Demo Org', 'etudesk-demo-org', ['STARTUP'], ['DIGITAL'], 'Organisation de démonstration', 'New York', 'US']
  );
  const org = await pool.query(`SELECT id FROM organizations WHERE slug = 'etudesk-demo-org'`);
  const organizationId = org.rows[0].id;

  // --- Talents (declared catalog skills) ---
  const talents = [
    { slug: 'demo-aminata', first: 'Aminata', last: 'Koné', email: 'demo.aminata@etudesk.dev', tags: ['JOB_SEEKER'], skills: [['React', 'advanced'], ['Node.js', 'intermediate'], ['SQL', 'intermediate'], ['Communication', 'advanced']] },
    { slug: 'demo-moussa', first: 'Moussa', last: 'Traoré', email: 'demo.moussa@etudesk.dev', tags: ['STUDENT'], skills: [['Python', 'intermediate'], ['Data Analytics', 'beginner'], ['Teamwork', 'intermediate']] },
    { slug: 'demo-fatou', first: 'Fatou', last: 'Diallo', email: 'demo.fatou@etudesk.dev', tags: ['SALARIED'], skills: [['Project Management', 'advanced'], ['Leadership', 'advanced'], ['Figma', 'intermediate']] },
  ];

  for (const tt of talents) {
    const tId = uuidv4();
    await pool.query(
      `INSERT INTO talents (id, slug, first_name, last_name, email, city, country, sectors, profile_tags, remote_ready, is_visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true)
       ON CONFLICT (slug) DO UPDATE SET first_name = EXCLUDED.first_name`,
      [tId, tt.slug, tt.first, tt.last, tt.email, 'New York', 'US', ['DIGITAL'], tt.tags]
    );
    const tRow = await pool.query(`SELECT id FROM talents WHERE slug = $1`, [tt.slug]);
    const talentId = tRow.rows[0].id;

    // also create a users row so the talent is a real account (optional)
    await pool.query(
      `INSERT INTO users (id, email, email_verified, talent_id)
       SELECT $1::uuid, $2::varchar, true, $3::uuid
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = $2::varchar AND deleted_at IS NULL)`,
      [uuidv4(), tt.email, talentId]
    );

    for (const [label, level] of tt.skills) {
      const r = await resolveLabel(label);
      if (!r) {
        console.warn(`  [skip skill] "${label}" not in catalog`);
        continue;
      }
      await pool.query(
        `INSERT INTO talent_skills (talent_id, competency_slug, level, score, origin, catalog_version, framework_version, last_evidence_at)
         VALUES ($1,$2,$3,$4,'declared',$5,$6,NOW())
         ON CONFLICT (talent_id, competency_slug) DO UPDATE SET level = EXCLUDED.level, score = EXCLUDED.score`,
        [talentId, r.slug, level, LEVEL_SCORE[level as Level] || 1, catalogVersion, FRAMEWORK_VERSION]
      );
    }
    console.log(`  talent ${tt.first} (${tt.skills.length} skills)`);
  }

  // --- Opportunities (with catalog skill tags) ---
  const opps = [
    {
      slug: 'demo-frontend-dev', title: 'Développeur Frontend React', contract: 'CDI',
      summary: 'Développer les interfaces de la plateforme Etudesk.',
      required: ['React', 'JavaScript'], nice: ['Node.js'],
    },
    {
      slug: 'demo-data-analyst', title: 'Data Analyst Junior', contract: 'CDD',
      summary: 'Analyser les données produit et construire des dashboards.',
      required: ['Data Analytics', 'SQL'], nice: ['Python'],
    },
    {
      slug: 'demo-product-manager', title: 'Product Manager', contract: 'CDI',
      summary: 'Piloter la roadmap produit et coordonner les équipes.',
      required: ['Project Management', 'Leadership'], nice: ['Figma'],
    },
  ];

  for (const op of opps) {
    const opId = uuidv4();
    await pool.query(
      `INSERT INTO opportunities (id, title, slug, type, contract_type, summary, sectors, location_type, locations, status, visibility, organization_id, posted_at)
       VALUES ($1,$2,$3,'JOB',$4,$5,$6,'ON_SITE',$7,'OPEN','PUBLIC',$8,NOW())
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, status = 'OPEN' RETURNING id`,
      [opId, op.title, op.slug, op.contract, op.summary, ['DIGITAL'], JSON.stringify([{ city: 'New York', country: 'US' }]), organizationId]
    );
    const opRow = await pool.query(`SELECT id FROM opportunities WHERE slug = $1`, [op.slug]);
    const oppId = opRow.rows[0].id;

    await pool.query(
      `INSERT INTO opportunity_posters (id, opportunity_id, poster_organization_id, role, posted_at)
       VALUES ($1,$2,$3,'POSTER',NOW()) ON CONFLICT DO NOTHING`,
      [uuidv4(), oppId, organizationId]
    );

    await pool.query(`DELETE FROM opportunity_skills WHERE opportunity_id = $1`, [oppId]);
    for (const slug of await resolveSlugs(op.required)) {
      await pool.query(
        `INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight)
         VALUES ($1,$2,'required',1.0) ON CONFLICT DO NOTHING`,
        [oppId, slug]
      );
    }
    for (const slug of await resolveSlugs(op.nice)) {
      await pool.query(
        `INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight)
         VALUES ($1,$2,'nice_to_have',0.5) ON CONFLICT DO NOTHING`,
        [oppId, slug]
      );
    }
    console.log(`  opportunity ${op.title}`);
  }

  // --- Community (soft-skill tags) ---
  const commId = uuidv4();
  await pool.query(
    `INSERT INTO communities (id, name, slug, type, description, access_type, visibility, sectors, city, country, status, organization_id, created_by)
     VALUES ($1,$2,$3,'PROFESSIONAL',$4,'OPEN','PUBLIC',$5,$6,$7,'ACTIVE',$8,NULL)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [commId, 'Dev Community New York', 'demo-dev-community', 'Communauté des développeurs', JSON.stringify(['DIGITAL']), 'New York', 'US', organizationId]
  );
  const commRow = await pool.query(`SELECT id FROM communities WHERE slug = 'demo-dev-community'`);
  const communityId = commRow.rows[0].id;
  await pool.query(`DELETE FROM community_skills WHERE community_id = $1`, [communityId]);
  for (const slug of await resolveSlugs(['Communication', 'Teamwork', 'Leadership'])) {
    await pool.query(
      `INSERT INTO community_skills (community_id, competency_slug, role) VALUES ($1,$2,'validates') ON CONFLICT DO NOTHING`,
      [communityId, slug]
    );
  }
  console.log('  community Dev Community New York');

  // --- Space (hard-skill / tool tags) ---
  const spaceId = uuidv4();
  await pool.query(
    `INSERT INTO spaces (id, name, slug, type, surface_m2, capacity, description, city, country, sectors, equipment, is_bookable, visibility, status, organization_id)
     VALUES ($1,$2,$3,'WORKSHOP',80,20,$4,'New York','US',$5,$6,true,'PUBLIC','ACTIVE',$7)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [spaceId, 'Atelier Fabrication Numérique', 'demo-fablab', 'Atelier de prototypage et fabrication numérique', ['DIGITAL'], ['Wifi', 'Imprimante 3D', 'Ordinateurs'], organizationId]
  );
  const spaceRow = await pool.query(`SELECT id FROM spaces WHERE slug = 'demo-fablab'`);
  const sId = spaceRow.rows[0].id;
  await pool.query(`DELETE FROM space_skills WHERE space_id = $1`, [sId]);
  for (const slug of await resolveSlugs(['Prototyping', 'CAD Modeling', 'Robotics Integration'])) {
    await pool.query(
      `INSERT INTO space_skills (space_id, competency_slug, role) VALUES ($1,$2,'validates') ON CONFLICT DO NOTHING`,
      [sId, slug]
    );
  }
  console.log('  space Atelier Fabrication Numérique');

  console.log('[seed-minimal] ✅ done');
  await pool.end();
}

main().catch((err) => {
  console.error('[seed-minimal] ❌', err);
  process.exit(1);
});
