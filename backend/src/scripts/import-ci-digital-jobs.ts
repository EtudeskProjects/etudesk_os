import fs from 'fs';
import path from 'path';
import { pool, generateSlug } from '../services/database';

type Job = {
  id: string;
  title: string;
  organization_name: string;
  location_city: string | null;
  location_region: string | null;
  country: string;
  posted_at_text: string;
  posted_at_inferred: string | null;
  source_name: string;
  source_url: string;
  external_apply_url: string;
  external_apply_email: string | null;
  application_mode: 'EMAIL';
  import_ready: boolean;
  verification_status: string;
  digital_family: string;
  skills: string[];
  summary: string;
};

type Dataset = {
  metadata: { count: number };
  jobs: Job[];
};

const DATASET_PATH =
  process.env.CI_DIGITAL_JOBS_DATASET ||
  path.resolve(__dirname, '../../../datasets/ci_digital_jobs_2026_06/jobs_ci_digital_2026_06.json');

const report = {
  organizations: { upserted: 0 },
  opportunities: { upserted: 0 },
  skills: [] as Array<{ jobId: string; applied: string[]; dropped: string[] }>,
  missingRecruitmentEmails: [] as Array<{ title: string; organization: string; externalApplyUrl: string }>,
};

const orgProfiles: Record<string, {
  website_url: string | null;
  logo_url: string | null;
  sectors: string[];
  types: string[];
  headquarters_city: string | null;
  headquarters_region: string | null;
  description: string;
}> = {
  'PHOENIX CONSULTING GROUP AFRICA': {
    website_url: 'https://phoenixcga.com',
    logo_url: 'https://logo.clearbit.com/phoenixcga.com',
    sectors: ['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
    types: ['COMPANY', 'TRAINING_PROVIDER'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Cabinet et organisme de conseil/recrutement actif sur les formations technologiques, la data et les solutions digitales.',
  },
  PROSUMA: {
    website_url: 'https://www.prosuma.ci',
    logo_url: 'https://logo.clearbit.com/prosuma.ci',
    sectors: ['COMMERCE', 'TRANSPORT', 'DIGITAL'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Groupe ivoirien de distribution et retail, avec des besoins digitaux autour du tracking, du reporting et des operations.',
  },
  myAgro: {
    website_url: 'https://www.myagro.org',
    logo_url: 'https://logo.clearbit.com/myagro.org',
    sectors: ['AGRICULTURE', 'DIGITAL', 'SOCIAL_IMPACT'],
    types: ['NGO', 'SOCIAL_ENTERPRISE'],
    headquarters_city: null,
    headquarters_region: null,
    description: 'Organisation AgriTech et impact social travaillant sur des solutions digitales pour les petits producteurs.',
  },
  'The Flex': {
    website_url: 'https://theflex.global',
    logo_url: 'https://logo.clearbit.com/theflex.global',
    sectors: ['DIGITAL', 'TOURISM', 'PROFESSIONAL_SERVICES'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Entreprise digitale orientee produit logiciel et operations de sejour flexible.',
  },
  'Africa Global Logistics': {
    website_url: 'https://www.africaglobal-logistics.com',
    logo_url: 'https://logo.clearbit.com/africaglobal-logistics.com',
    sectors: ['TRANSPORT', 'DIGITAL', 'INDUSTRY'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Acteur logistique panafricain avec des besoins data, BI, support applicatif et qualite logicielle.',
  },
  "Orange Cote d'Ivoire": {
    website_url: 'https://www.orange.ci',
    logo_url: 'https://logo.clearbit.com/orange.ci',
    sectors: ['DIGITAL', 'FINANCE'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Operateur telecom et services numeriques en Cote d Ivoire.',
  },
  Prysmian: {
    website_url: 'https://www.prysmian.com',
    logo_url: 'https://logo.clearbit.com/prysmian.com',
    sectors: ['INDUSTRY', 'DIGITAL'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Groupe industriel international avec besoins en systemes et applications metiers.',
  },
  'Wave Mobile Money': {
    website_url: 'https://www.wave.com',
    logo_url: 'https://logo.clearbit.com/wave.com',
    sectors: ['FINANCE', 'DIGITAL'],
    types: ['COMPANY', 'FINTECH'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Fintech mobile money operant en Afrique de l Ouest avec des besoins IT et operations.',
  },
  'Mass Markets': {
    website_url: 'https://www.massmarkets.com',
    logo_url: 'https://logo.clearbit.com/massmarkets.com',
    sectors: ['DIGITAL', 'PROFESSIONAL_SERVICES'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Entreprise de services digitaux et operations clients publiant des talent pools autour de l IA et de la data.',
  },
  'Crossing Hurdles': {
    website_url: 'https://www.crossinghurdles.com',
    logo_url: 'https://logo.clearbit.com/crossinghurdles.com',
    sectors: ['DIGITAL', 'PROFESSIONAL_SERVICES'],
    types: ['COMPANY'],
    headquarters_city: null,
    headquarters_region: null,
    description: 'Plateforme de missions specialisees dans les donnees linguistiques, l annotation et les projets IA.',
  },
  'Save the Children International': {
    website_url: 'https://www.savethechildren.net',
    logo_url: 'https://logo.clearbit.com/savethechildren.net',
    sectors: ['SOCIAL_IMPACT', 'DIGITAL', 'RESEARCH'],
    types: ['NGO'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'ONG internationale ayant des besoins data et insights pour ses programmes.',
  },
  'Neemba Group': {
    website_url: 'https://www.neemba.com',
    logo_url: 'https://logo.clearbit.com/neemba.com',
    sectors: ['INDUSTRY', 'COMMERCE', 'DIGITAL'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Groupe d equipements et services B2B avec besoins en analyse marche et pilotage commercial.',
  },
  Promasidor: {
    website_url: 'https://www.promasidor.com',
    logo_url: 'https://logo.clearbit.com/promasidor.com',
    sectors: ['INDUSTRY', 'COMMERCE', 'DIGITAL'],
    types: ['COMPANY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Groupe agroalimentaire avec besoins en analytics commercial et business intelligence.',
  },
  'BOA CI': {
    website_url: 'https://www.bank-of-africa.net',
    logo_url: 'https://logo.clearbit.com/bank-of-africa.net',
    sectors: ['FINANCE', 'DIGITAL'],
    types: ['COMPANY', 'BANK'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Banque commerciale en Cote d Ivoire avec besoins IT applicatifs et exploitation.',
  },
  'GIZ Cote d\'Ivoire': {
    website_url: 'https://www.giz.de',
    logo_url: 'https://logo.clearbit.com/giz.de',
    sectors: ['SOCIAL_IMPACT', 'PUBLIC', 'DIGITAL'],
    types: ['NGO', 'DEVELOPMENT_AGENCY'],
    headquarters_city: 'Abidjan',
    headquarters_region: 'Abidjan',
    description: 'Agence de cooperation internationale active sur des projets de developpement, donnees et systemes d information.',
  },
};

const imageByFamily: Record<string, string> = {
  ai_ml_automation: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80',
  ai_data_annotation: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
  ai_governance: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80',
  software_engineering: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1600&q=80',
  data_analytics_bi: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
  cloud_devops_infrastructure: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80',
  cybersecurity_digital_trust: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80',
  quality_assurance: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80',
  it_applications_support: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
  it_management: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
  formation_tech_data: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
  data_operations_tracking: 'https://images.unsplash.com/photo-1485575301924-6891ef935dcd?auto=format&fit=crop&w=1600&q=80',
  knowledge_data_systems: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80',
};

const skillAliases: Record<string, string[]> = {
  programmation: ['software-architecture', 'version-control-workflows'],
  'software-engineering': ['software-architecture', 'ai-assisted-software-development'],
  backend: ['backend-engineering', 'api-design'],
  frontend: ['frontend-engineering', 'web-application-development'],
  'full-stack-development': ['frontend-engineering', 'backend-engineering', 'web-application-development'],
  'product-engineering': ['product-management', 'product-management-fundamentals', 'software-architecture'],
  python: ['python'],
  java: ['java'],
  sql: ['sql'],
  nosql: ['database-design', 'vector-databases'],
  git: ['git'],
  linux: ['linux-system-administration'],
  ux: ['ux-ui-principles', 'ux-writing'],
  agile: ['agile-project-management'],
  agritech: ['precision-agriculture-data-analysis', 'farm-management-information-systems'],
  'data-science': ['data-analytics', 'machine-learning-fundamentals'],
  'data-analysis': ['data-analytics', 'data-visualization'],
  analytics: ['data-analytics', 'business-intelligence'],
  insights: ['data-analytics', 'business-intelligence'],
  'market-analysis': ['market-research', 'data-analytics'],
  'commercial-analytics': ['data-analytics', 'business-intelligence'],
  'business-intelligence': ['business-intelligence'],
  dashboards: ['dashboard-design', 'data-visualization'],
  reporting: ['data-visualization', 'dashboard-design'],
  excel: ['microsoft-excel'],
  'kpi-management': ['dashboard-design', 'business-intelligence'],
  'data-support': ['data-analytics', 'business-intelligence'],
  'database-administration': ['database-design', 'simple-database-tools'],
  'backup-restore': ['database-design'],
  performance: ['performance-optimization'],
  'application-support': ['web-application-development', 'incident-management'],
  'application-operations': ['web-application-development', 'incident-management'],
  'production-support': ['incident-management', 'infrastructure-monitoring'],
  'incident-management': ['incident-management'],
  'banking-it': ['transaction-monitoring', 'web-application-development'],
  'business-analysis': ['business-analysis'],
  'systems-analysis': ['business-analysis', 'software-documentation'],
  'information-systems': ['geographic-information-systems', 'student-information-systems'],
  'knowledge-management': ['personal-knowledge-management', 'knowledge-retrieval'],
  'data-management': ['master-data-management', 'data-governance'],
  'it-management': ['platform-governance', 'information-security-management'],
  infrastructure: ['infrastructure-as-code', 'networking-fundamentals'],
  operations: ['retail-operations-management'],
  'team-leadership': ['remote-team-leadership'],
  'machine-learning': ['machine-learning-fundamentals'],
  'ai-engineering': ['ai-workflow-integration', 'machine-learning-fundamentals'],
  'model-development': ['predictive-modeling', 'model-deployment'],
  'ai-agent-orchestration': ['ai-agent-orchestration'],
  'llm-applications': ['llm-architectures', 'llmops'],
  'workflow-automation': ['agentic-workflow-automation', 'business-process-automation-design'],
  'prompt-engineering': ['prompt-engineering'],
  'generative-ai': ['generative-ai-content-production', 'foundation-models'],
  'llm-evaluation': ['llm-evaluation-and-benchmarking'],
  'data-annotation': ['data-labeling-and-annotation'],
  'data-quality': ['data-quality-engineering'],
  'ai-training-data': ['data-labeling-and-annotation', 'data-quality-engineering'],
  transcription: ['speech-recognition-engineering', 'data-labeling-and-annotation'],
  'language-data': ['natural-language-processing', 'data-labeling-and-annotation'],
  dioula: ['natural-language-processing'],
  'ai-security': ['ai-ml-security', 'ai-security-testing'],
  'model-safety': ['ai-safety', 'guardrails'],
  'security-analysis': ['security-operations'],
  security: ['cybersecurity-fundamentals'],
  'risk-analysis': ['risk-mitigation'],
  'risk-management': ['ai-risk-management', 'risk-mitigation'],
  'responsible-ai': ['responsible-ai'],
  'ai-governance': ['ai-governance'],
  ethics: ['ethical-ai'],
  'ai-evaluation': ['llm-evaluation-and-benchmarking', 'model-interpretability'],
  'quality-assurance': ['software-testing-and-qa'],
  qa: ['software-testing-and-qa'],
  'test-management': ['test-automation', 'software-testing-and-qa'],
  'functional-testing': ['software-testing-and-qa', 'test-driven-development'],
  'bug-reporting': ['software-testing-and-qa'],
  'chatbot-testing': ['chatbot-and-assistant-design', 'software-testing-and-qa'],
  'conversation-design': ['chatbot-and-assistant-design'],
  'fleet-tracking': ['fleet-data-analytics', 'dashboard-design'],
  monitoring: ['infrastructure-monitoring', 'grafana'],
};

function safeDate(input: string | null): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

function normalizeOrgName(name: string): string {
  if (name === 'Wave Gambia') return 'Wave Mobile Money';
  if (name === "Orange Côte d'Ivoire") return "Orange Cote d'Ivoire";
  if (name === 'GIZ Côte d\'Ivoire') return "GIZ Cote d'Ivoire";
  return name;
}

function makeLocations(job: Job) {
  if (job.location_city || job.location_region) {
    return [{
      city: job.location_city || job.location_region,
      region: job.location_region || job.location_city,
      country: 'CI',
    }];
  }
  return [{ city: null, region: null, country: 'CI' }];
}

function inferLocationType(job: Job): 'ON_SITE' | 'REMOTE' | 'HYBRID' {
  return /remote|freelance/i.test(`${job.title} ${job.summary}`) ? 'REMOTE' : 'ON_SITE';
}

function inferSectors(job: Job, orgName: string): string[] {
  const org = orgProfiles[orgName];
  if (org?.sectors?.length) return org.sectors.slice(0, 5);
  const skills = job.skills.join(' ');
  return compact([
    'DIGITAL',
    /agri|food/i.test(skills + job.summary) ? 'AGRICULTURE' : null,
    /finance|bank|money/i.test(orgName + job.summary) ? 'FINANCE' : null,
    /training|formateur|education/i.test(job.title + job.summary) ? 'EDUCATION' : null,
  ]).slice(0, 5);
}

async function ensureExternalColumns() {
  await pool.query(`
    ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS application_mode VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
      ADD COLUMN IF NOT EXISTS external_apply_email TEXT,
      ADD COLUMN IF NOT EXISTS external_apply_url TEXT,
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS source_name TEXT;
  `);
  await pool.query(`ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_application_mode_check`);
  await pool.query(`
    ALTER TABLE opportunities
      ADD CONSTRAINT opportunities_application_mode_check
      CHECK (application_mode IN ('IN_APP', 'EMAIL'))
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_opportunities_application_mode
    ON opportunities(application_mode)
    WHERE deleted_at IS NULL
  `);
}

async function upsertOrganization(job: Job): Promise<string> {
  const orgName = normalizeOrgName(job.organization_name);
  const profile = orgProfiles[orgName] || {
    website_url: null,
    logo_url: null,
    sectors: inferSectors(job, orgName),
    types: ['COMPANY'],
    headquarters_city: job.location_city,
    headquarters_region: job.location_region,
    description: `Organisation source d une opportunite numerique collectee en Cote d Ivoire: ${orgName}.`,
  };
  const slug = generateSlug(orgName);
  const { rows } = await pool.query(
    `INSERT INTO organizations (
       name, slug, types, sectors, description, logo_url, website_url, contact_email,
       headquarters_city, headquarters_region, headquarters_country, verification_status, is_visible,
       created_at, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CI','CLAIMED',TRUE,NOW(),NOW())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       types = EXCLUDED.types,
       sectors = EXCLUDED.sectors,
       description = EXCLUDED.description,
       logo_url = COALESCE(EXCLUDED.logo_url, organizations.logo_url),
       website_url = COALESCE(EXCLUDED.website_url, organizations.website_url),
       contact_email = COALESCE(EXCLUDED.contact_email, organizations.contact_email),
       headquarters_city = COALESCE(EXCLUDED.headquarters_city, organizations.headquarters_city),
       headquarters_region = COALESCE(EXCLUDED.headquarters_region, organizations.headquarters_region),
       headquarters_country = 'CI',
       is_visible = TRUE,
       updated_at = NOW()
     RETURNING id`,
    [
      orgName,
      slug,
      profile.types,
      profile.sectors,
      profile.description,
      profile.logo_url,
      profile.website_url,
      job.external_apply_email,
      profile.headquarters_city || job.location_city,
      profile.headquarters_region || job.location_region,
    ]
  );
  report.organizations.upserted += 1;
  return rows[0].id;
}

async function resolveCompetencySlugs(skills: string[]) {
  const candidates = [...new Set(skills.flatMap((skill) => skillAliases[skill] || [skill]))];
  if (candidates.length === 0) return { applied: [], dropped: skills };
  const { rows } = await pool.query(
    `SELECT slug FROM competencies WHERE slug = ANY($1::text[])`,
    [candidates]
  );
  const existing = new Set(rows.map((row) => row.slug as string));
  return {
    applied: candidates.filter((slug) => existing.has(slug)),
    dropped: candidates.filter((slug) => !existing.has(slug)),
  };
}

async function upsertOpportunity(job: Job, organizationId: string): Promise<string> {
  const title = job.title;
  const orgName = normalizeOrgName(job.organization_name);
  const slug = `${generateSlug(title)}-${generateSlug(orgName)}-${job.id.slice(-8)}`.slice(0, 240);
  const coverImage = imageByFamily[job.digital_family] || imageByFamily.software_engineering;
  const postedAt = safeDate(job.posted_at_inferred) || new Date();
  const deadline = new Date('2026-07-31T23:59:59.000Z');
  const sectors = inferSectors(job, orgName);
  const email = job.external_apply_email || null;
  const locations = makeLocations(job);
  const requirements = [
    `Famille referentiel: ${job.digital_family}.`,
    `Competences source: ${job.skills.join(', ')}.`,
    'Candidature externe: envoyer un email au recruteur quand une adresse est disponible.',
  ].join('\n');

  if (!email) {
    report.missingRecruitmentEmails.push({
      title: job.title,
      organization: orgName,
      externalApplyUrl: job.external_apply_url,
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO opportunities (
       title, slug, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
       organization_id, sectors, cv_required, application_questions, cover_image_url, images,
       currency, location_type, locations, visibility, posted_at, deadline, status,
       application_mode, external_apply_email, external_apply_url, source_url, source_name,
       created_at, updated_at
     )
     VALUES (
       $1,$2,'EMPLOYMENT',NULL,'FULL_TIME',$3,$4,NULL,
       $5,$6,TRUE,'[]'::jsonb,$7,$8,
       'XOF',$9,$10,'PUBLIC',$11,$12,'OPEN',
       'EMAIL',$13,$14,$15,$16,
       NOW(),NOW()
     )
     ON CONFLICT (slug) DO UPDATE SET
       summary = EXCLUDED.summary,
       requirements = EXCLUDED.requirements,
       organization_id = EXCLUDED.organization_id,
       sectors = EXCLUDED.sectors,
       cover_image_url = EXCLUDED.cover_image_url,
       images = EXCLUDED.images,
       location_type = EXCLUDED.location_type,
       locations = EXCLUDED.locations,
       posted_at = EXCLUDED.posted_at,
       deadline = EXCLUDED.deadline,
       status = 'OPEN',
       application_mode = 'EMAIL',
       external_apply_email = EXCLUDED.external_apply_email,
       external_apply_url = EXCLUDED.external_apply_url,
       source_url = EXCLUDED.source_url,
       source_name = EXCLUDED.source_name,
       updated_at = NOW()
     RETURNING id`,
    [
      title,
      slug,
      job.summary,
      requirements,
      organizationId,
      sectors,
      coverImage,
      [coverImage],
      inferLocationType(job),
      JSON.stringify(locations),
      postedAt,
      deadline,
      email,
      job.external_apply_url,
      job.source_url,
      job.source_name,
    ]
  );

  const opportunityId = rows[0].id;
  await pool.query(
    `INSERT INTO opportunity_posters (opportunity_id, poster_organization_id, role, posted_at)
     VALUES ($1, $2, 'POSTER', NOW())
     ON CONFLICT (opportunity_id, poster_organization_id) DO UPDATE SET role = EXCLUDED.role`,
    [opportunityId, organizationId]
  );

  const skillResolution = await resolveCompetencySlugs(job.skills);
  await pool.query('DELETE FROM opportunity_skills WHERE opportunity_id = $1', [opportunityId]);
  for (const slug of skillResolution.applied) {
    await pool.query(
      `INSERT INTO opportunity_skills (opportunity_id, competency_slug, requirement, weight, min_level)
       VALUES ($1, $2, 'required', 1.0, 'beginner')
       ON CONFLICT (opportunity_id, competency_slug) DO UPDATE
         SET requirement = EXCLUDED.requirement, weight = EXCLUDED.weight, min_level = EXCLUDED.min_level`,
      [opportunityId, slug]
    );
  }
  report.skills.push({ jobId: job.id, applied: skillResolution.applied, dropped: skillResolution.dropped });
  report.opportunities.upserted += 1;
  return opportunityId;
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8')) as Dataset;
  if (dataset.metadata.count !== dataset.jobs.length) {
    throw new Error(`Dataset count mismatch: metadata=${dataset.metadata.count}, jobs=${dataset.jobs.length}`);
  }

  await ensureExternalColumns();

  for (const job of dataset.jobs) {
    const organizationId = await upsertOrganization(job);
    await upsertOpportunity(job, organizationId);
  }

  const outPath = process.env.CI_DIGITAL_JOBS_REPORT || path.resolve(process.cwd(), 'ci-digital-jobs-import-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
