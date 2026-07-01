/**
 * TOOLS AUDIT — Real integration tests
 * Tests every copilot tool with real DB/API data and captures actual outputs
 * Run: npx tsx src/services/copilot/tools/__tests__/tools-audit.ts
 */

import 'dotenv/config';
import * as path from 'path';
import { pool } from '../../../database';
import { smartSearchTool } from '../smart-search.tool';
import { createSqlQueryTool } from '../sql-query.tool';
import { youtubeSearchTool } from '../youtube-search.tool';
import { createGenerateDocumentTool } from '../generate-document.tool';
import { generateImageTool } from '../generate-image.tool';
import { generateDiagramTool } from '../generate-diagram.tool';
import { createManageSkillsTool } from '../manage-skills.tool';
import { createExecuteActionTool } from '../execute-action.tool';
import { generateToolSummary } from '../../stream/tool-summary';

// Test constants (resolved dynamically from DB at runtime)
const PREFERRED_TALENT_SLUG = process.env.COPILOT_AUDIT_TALENT_SLUG || 'app-review';
const FIXTURE_OVERRIDES = {
  talentId: process.env.COPILOT_AUDIT_TALENT_ID || '',
  orgId: process.env.COPILOT_AUDIT_ORG_ID || '',
  documentId: process.env.COPILOT_AUDIT_DOCUMENT_ID || '',
  opportunityId: process.env.COPILOT_AUDIT_OPPORTUNITY_ID || '',
  communityId: process.env.COPILOT_AUDIT_COMMUNITY_ID || '',
  spaceId: process.env.COPILOT_AUDIT_SPACE_ID || '',
};

interface FixtureIds {
  talentId: string;
  orgId: string | null;
  documentId: string | null;
  opportunityId: string | null;
  communityId: string | null;
  spaceId: string | null;
}

interface TestResult {
  tool: string;
  test: string;
  input: any;
  output: any;
  summary: string;
  duration: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
  outputBytes?: number;
  outputKeys?: string[];
}

const results: TestResult[] = [];
const AUDIT_DOCUMENT_TITLES = [
  'Rapport de Competences',
  'Export Talents',
  'Export CSV',
  'Stats Opportunites',
  'Notes reunion',
  'CV Lamine Barro',
];
const columnExistsCache = new Map<string, boolean>();

async function tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!;

  const res = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  const exists = res.rows.length > 0;
  columnExistsCache.set(key, exists);
  return exists;
}

async function optionalNullClause(tableName: string, columnName: string, qualifier?: string): Promise<string> {
  if (!(await tableHasColumn(tableName, columnName))) return '';
  return ` AND ${(qualifier || tableName)}.${columnName} IS NULL`;
}

/**
 * Provider-neutral ToolDefinition pattern: toolObj.execute(params)
 * execute() receives parsed params and returns the result directly.
 */
async function invokeTool(toolObj: any, params: Record<string, any>): Promise<any> {
  return toolObj.execute(params);
}

async function runTest(
  tool: string,
  test: string,
  params: any,
  toolObj: any,
  summaryArgs?: { toolName: string; args?: Record<string, unknown> },
  options?: { expectSuccess?: boolean }
): Promise<void> {
  const start = Date.now();
  try {
    const output = await invokeTool(toolObj, params);
    const duration = Date.now() - start;
    const sArgs = summaryArgs || { toolName: tool };
    const summary = generateToolSummary(sArgs.toolName, output, false, sArgs.args || params);
    const outputJson = JSON.stringify(output);
    const outputBytes = Buffer.byteLength(outputJson || '', 'utf8');
    const outputKeys = output && typeof output === 'object' ? Object.keys(output).slice(0, 12) : [];
    const expectSuccess = options?.expectSuccess ?? true;
    const isBusinessFailure =
      expectSuccess &&
      output &&
      typeof output === 'object' &&
      'success' in output &&
      (output as any).success === false;

    if (isBusinessFailure) {
      const errMsg = String((output as any).error || (output as any).message || 'Tool returned success=false');
      results.push({ tool, test, input: params, output, summary, duration, status: 'FAIL', error: errMsg, outputBytes, outputKeys });
      console.log(`  ✗ ${test} (${duration}ms) → ERROR: ${errMsg.slice(0, 150)}`);
      return;
    }

    results.push({ tool, test, input: params, output, summary, duration, status: 'PASS', outputBytes, outputKeys });
    console.log(`  ✓ ${test} (${duration}ms, ${outputBytes}B) → summary: "${summary}"`);
  } catch (err: any) {
    const duration = Date.now() - start;
    const summary = generateToolSummary(tool, err.message, true);
    results.push({ tool, test, input: params, output: null, summary, duration, status: 'FAIL', error: err.message });
    console.log(`  ✗ ${test} (${duration}ms) → ERROR: ${err.message?.slice(0, 150)}`);
  }
}

async function resolveFixtureIds(): Promise<FixtureIds> {
  const [
    talentsHasSlug,
    talentsHasCreatedAt,
    talentDeletedClause,
    docDeletedClause,
    opportunityDeletedClause,
    communityDeletedClause,
    spaceDeletedClause,
  ] = await Promise.all([
    tableHasColumn('talents', 'slug'),
    tableHasColumn('talents', 'created_at'),
    optionalNullClause('talents', 'deleted_at'),
    optionalNullClause('talent_documents', 'deleted_at'),
    optionalNullClause('opportunities', 'deleted_at', 'o'),
    optionalNullClause('communities', 'deleted_at', 'c'),
    optionalNullClause('spaces', 'deleted_at', 's'),
  ]);

  let activeTalentId: string | undefined = FIXTURE_OVERRIDES.talentId || undefined;
  if (!activeTalentId && talentsHasSlug) {
    const talentRes = await pool.query(
      `SELECT id
       FROM talents
       WHERE slug = $1
         ${talentDeletedClause}
       LIMIT 1`,
      [PREFERRED_TALENT_SLUG]
    );
    activeTalentId = talentRes.rows[0]?.id as string | undefined;
  }
  if (!activeTalentId) {
    const orderBy = talentsHasSlug
      ? `ORDER BY (slug = 'app-review') DESC${talentsHasCreatedAt ? ', created_at DESC' : ''}`
      : (talentsHasCreatedAt ? 'ORDER BY created_at DESC' : 'ORDER BY id DESC');
    const fallbackTalentRes = await pool.query(
      `SELECT id
       FROM talents
       WHERE TRUE
       ${talentDeletedClause}
       ${orderBy}
       LIMIT 1`
    );
    activeTalentId = fallbackTalentRes.rows[0]?.id;
  }
  if (!activeTalentId) {
    throw new Error('No active talent found for tools audit.');
  }

  const [orgRes, docRes, oppRes, commRes, spaceRes] = await Promise.all([
    FIXTURE_OVERRIDES.orgId
      ? Promise.resolve({ rows: [{ organization_id: FIXTURE_OVERRIDES.orgId }] })
      : pool.query(
      `SELECT om.organization_id
       FROM organization_members om
       WHERE om.talent_id = $1 AND om.status = 'ACTIVE'
       ORDER BY om.created_at DESC
       LIMIT 1`,
      [activeTalentId]
    ),
    FIXTURE_OVERRIDES.documentId
      ? Promise.resolve({ rows: [{ id: FIXTURE_OVERRIDES.documentId }] })
      : pool.query(
      `SELECT id
       FROM talent_documents
       WHERE talent_id = $1
       ${docDeletedClause}
       ORDER BY (original_filename LIKE 'seed-ops-%') DESC, created_at DESC
       LIMIT 1`,
      [activeTalentId]
    ),
    FIXTURE_OVERRIDES.opportunityId
      ? Promise.resolve({ rows: [{ id: FIXTURE_OVERRIDES.opportunityId }] })
      : pool.query(
      `SELECT o.id
       FROM opportunities o
       WHERE o.status = 'OPEN'
       ${opportunityDeletedClause}
       ORDER BY o.created_at DESC
       LIMIT 1`
    ),
    FIXTURE_OVERRIDES.communityId
      ? Promise.resolve({ rows: [{ id: FIXTURE_OVERRIDES.communityId }] })
      : pool.query(
      `SELECT c.id
       FROM communities c
       WHERE c.status = 'ACTIVE'
       ${communityDeletedClause}
       ORDER BY c.created_at DESC
       LIMIT 1`
    ),
    FIXTURE_OVERRIDES.spaceId
      ? Promise.resolve({ rows: [{ id: FIXTURE_OVERRIDES.spaceId }] })
      : pool.query(
      `SELECT s.id
       FROM spaces s
       WHERE s.status = 'ACTIVE'
       ${spaceDeletedClause}
       ORDER BY s.created_at DESC
       LIMIT 1`
    ),
  ]);

  return {
    talentId: activeTalentId,
    orgId: orgRes.rows[0]?.organization_id || null,
    documentId: docRes.rows[0]?.id || null,
    opportunityId: oppRes.rows[0]?.id || null,
    communityId: commRes.rows[0]?.id || null,
    spaceId: spaceRes.rows[0]?.id || null,
  };
}

async function cleanupAuditGeneratedDocuments(talentId: string): Promise<void> {
  await pool.query(
    `DELETE FROM talent_documents
     WHERE talent_id = $1
       AND title = ANY($2::text[])`,
    [talentId, AUDIT_DOCUMENT_TITLES]
  );
}

(async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         ETUDESK COPILOT TOOLS — AUDIT RÉEL          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  let fixtures: FixtureIds;
  try {
    fixtures = await resolveFixtureIds();
  } catch (error: any) {
    console.error('Impossible de résoudre les fixtures du harnais Copilot.');
    console.error(`Cause: ${error.message}`);
    console.error('Si le rôle DB ne peut pas lire les tables de fixtures, définis au minimum COPILOT_AUDIT_TALENT_ID, puis les autres COPILOT_AUDIT_*_ID utiles.');
    await pool.end();
    process.exit(1);
  }
  await cleanupAuditGeneratedDocuments(fixtures.talentId);
  console.log(`ℹ Talent audit utilisé: ${fixtures.talentId}`);

  // ═══════════════════════════════════════════
  // 1. VECTOR_QUERY
  // ═══════════════════════════════════════════
  console.log('┌─ 1. smart_search ──────────────────────────────────');

  await runTest('smart_search', 'Recherche opportunités dev React remote',
    { query: 'développeur React Node.js remote', entity: 'opportunities', topK: 5, filtersJson: null },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'opportunities' } }
  );

  await runTest('smart_search', 'Recherche talents fullstack',
    { query: 'développeur fullstack Python Django', entity: 'talents', topK: 5, filtersJson: null },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'talents' } }
  );

  await runTest('smart_search', 'Recherche communautés tech',
    { query: 'communauté startup tech innovation', entity: 'communities', topK: 5, filtersJson: null },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'communities' } }
  );

  await runTest('smart_search', 'Recherche espaces coworking',
    { query: 'espace coworking salle réunion', entity: 'spaces', topK: 5, filtersJson: null },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'spaces' } }
  );

  await runTest('smart_search', 'Recherche organisations fintech',
    { query: 'fintech paiement mobile Afrique', entity: 'organizations', topK: 5, filtersJson: null },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'organizations' } }
  );

  await runTest('smart_search', 'Avec filtre contract_type CDI',
    { query: 'emploi marketing digital', entity: 'opportunities', topK: 5, filtersJson: '{"contract_type":"CDI"}' },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'opportunities' } }
  );

  // Entity inference test — NO entity param, should infer from query
  await runTest('smart_search', 'Entity inference (communauté sans entity param)',
    { query: 'communauté tech innovation remote', topK: 5 },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'communities' } }
  );

  await runTest('smart_search', 'Entity inference (stage sans entity param)',
    { query: 'stage développement web', topK: 5 },
    smartSearchTool,
    { toolName: 'smart_search', args: { entity: 'opportunities' } }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 2. SQL_QUERY
  // ═══════════════════════════════════════════
  console.log('┌─ 2. sql_query ─────────────────────────────────────');

  const authorizedOrgIds = fixtures.orgId ? [fixtures.orgId] : undefined;
  const sqlTool = createSqlQueryTool(fixtures.talentId, authorizedOrgIds);

  // Personal intents
  const myIntents = ['my_profile', 'my_applications', 'my_communities', 'my_skills', 'my_documents', 'my_bookmarks', 'my_reservations', 'my_invitations'];
  for (const intent of myIntents) {
    await runTest('sql_query', intent,
      { intent, paramsJson: '{}' },
      sqlTool,
      { toolName: 'sql_query', args: { intent } }
    );
  }

  // Org intents
  const orgIntents = ['org_stats', 'org_members', 'org_opportunities', 'org_communities', 'org_spaces', 'org_invitations'];
  for (const intent of orgIntents) {
    if (!fixtures.orgId) {
      results.push({ tool: 'sql_query', test: `${intent} (SKIP — no org membership)`, input: { intent }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
      console.log(`  ⊘ ${intent} (SKIP — no org membership)`);
      continue;
    }
    await runTest('sql_query', intent,
      { intent, paramsJson: JSON.stringify({ organizationId: fixtures.orgId }) },
      sqlTool,
      { toolName: 'sql_query', args: { intent } }
    );
  }

  // org_applications
  if (fixtures.orgId) {
    await runTest('sql_query', 'org_applications',
      { intent: 'org_applications', paramsJson: JSON.stringify({ organizationId: fixtures.orgId }) },
      sqlTool,
      { toolName: 'sql_query', args: { intent: 'org_applications' } }
    );
  } else {
    results.push({ tool: 'sql_query', test: 'org_applications (SKIP — no org membership)', input: { intent: 'org_applications' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
    console.log('  ⊘ org_applications (SKIP — no org membership)');
  }

  // Edge: org intent without orgId
  await runTest('sql_query', 'org_stats sans organizationId (edge)',
    { intent: 'org_stats', paramsJson: '{}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'org_stats' } }
  );

  // Edge: restricted intent in study mode
  const studySqlTool = createSqlQueryTool(fixtures.talentId, authorizedOrgIds, ['my_profile', 'my_skills', 'my_documents'] as any);
  await runTest('sql_query', 'Intent bloqué en mode study (edge)',
    { intent: 'my_applications', paramsJson: '{}' },
    studySqlTool,
    { toolName: 'sql_query', args: { intent: 'my_applications' } }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 3. YOUTUBE_SEARCH
  // ═══════════════════════════════════════════
  console.log('┌─ 3. youtube_search ────────────────────────────────');

  await runTest('youtube_search', 'Tutoriel React français',
    { query: 'React hooks tutoriel français', maxResults: 1 },
    youtubeSearchTool,
    { toolName: 'youtube_search' }
  );

  await runTest('youtube_search', 'Entrepreneuriat startup',
    { query: 'entrepreneuriat startup numérique', maxResults: 2 },
    youtubeSearchTool,
    { toolName: 'youtube_search' }
  );

  await runTest('youtube_search', 'Sujet niche fintech',
    { query: 'mobile money API integration fintech', maxResults: 1 },
    youtubeSearchTool,
    { toolName: 'youtube_search' }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 4. GENERATE_DOCUMENT
  // ═══════════════════════════════════════════
  console.log('┌─ 4. generate_document ─────────────────────────────');

  const genDocTool = createGenerateDocumentTool(fixtures.talentId);

  await runTest('generate_document', 'PDF Sections (rapport)',
    { format: 'PDF', title: 'Rapport de Competences', contentJson: '{"sections":[{"heading":"Profil","body":"Développeur fullstack avec 5 ans d\'expérience."},{"heading":"Compétences clés","body":"React, Node.js et PostgreSQL."}]}', instructions: 'Rapport de compétences professionnel' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'DOCX Table (export données)',
    { format: 'DOCX', title: 'Export Talents', contentJson: '{"headers":["Nom","Ville","Compétence"],"rows":[["Lamine Barro","Remote","React"],["Estelle Traoré","Remote","Python"]]}', instructions: 'Export tableau des talents' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'CSV (export données)',
    { format: 'CSV', title: 'Export CSV', contentJson: '{"headers":["Nom","Email"],"rows":[["Lamine","lamine@etudesk.com"],["Estelle","estelle@test.com"]]}', instructions: 'Export CSV simple' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'XLS (spreadsheet)',
    { format: 'XLS', title: 'Stats Opportunites', contentJson: '{"headers":["Type","Count"],"rows":[["CDI","15"],["CDD","8"],["Stage","5"]]}', instructions: 'Statistiques par type de contrat' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'TXT (plain text)',
    { format: 'TXT', title: 'Notes reunion', contentJson: '{"sections":[{"heading":"Ordre du jour","body":"Discussion sur la roadmap Q1 2026."}]}', instructions: 'Notes de reunion' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'PDF CV (format structuré)',
    { format: 'PDF', title: 'CV Lamine Barro', contentJson: JSON.stringify({
      firstName: 'Lamine', lastName: 'Barro', email: 'lamine@etudesk.com', phone: '+33 6 00 00 00 00',
      city: 'Remote', country: 'Global', bio: 'Fondateur & CEO Etudesk.',
      skills: [{ name: 'React', type: 'hard', level: 'expert' }, { name: 'Node.js', type: 'hard', level: 'advanced' }],
      languages: [{ language: 'Francais', level: 'native' }],
      experiences: [{ title: 'CEO', company: 'Etudesk', location: 'Remote', period: '2020 - Present', description: 'Direction plateforme.' }],
      education: [{ degree: 'Master Informatique', institution: 'Université numérique', location: 'Remote', period: '2016 - 2018' }]
    }), instructions: 'CV professionnel' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 5. GENERATE_IMAGE (skip — API costs)
  // ═══════════════════════════════════════════
  console.log('┌─ 5. generate_image (SKIP — coûteux, ~60s/image) ──');
  console.log('  ⊘ Skipped (API cost + latency).');
  results.push({ tool: 'generate_image', test: 'SKIPPED (API cost)', input: { prompt: 'test', size: '1024x1024', quality: 'low' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
  console.log('');

  // ═══════════════════════════════════════════
  // 6. GENERATE_DIAGRAM
  // ═══════════════════════════════════════════
  console.log('┌─ 6. generate_diagram ──────────────────────────────');

  await runTest('generate_diagram', 'Flowchart recrutement',
    { title: 'Processus de Recrutement', diagramType: 'flowchart', mermaidCode: 'flowchart TD\n    A[Offre publiee] --> B{Candidatures?}\n    B -->|Oui| C[Tri des CV]\n    B -->|Non| D[Relancer]\n    C --> E[Entretiens]\n    E --> F{Retenu?}\n    F -->|Oui| G[Embauche]\n    F -->|Non| H[Feedback]' },
    generateDiagramTool,
    { toolName: 'generate_diagram' }
  );

  await runTest('generate_diagram', 'Mindmap compétences',
    { title: 'Competences Tech', diagramType: 'mindmap', mermaidCode: 'mindmap\n  root((Tech Skills))\n    Frontend\n      React\n      TypeScript\n    Backend\n      Node.js\n      PostgreSQL' },
    generateDiagramTool,
    { toolName: 'generate_diagram' }
  );

  await runTest('generate_diagram', 'Pie chart distribution',
    { title: 'Repartition Contrats', diagramType: 'pie', mermaidCode: 'pie title Repartition des contrats\n    "CDI" : 45\n    "CDD" : 25\n    "Stage" : 20\n    "Freelance" : 10' },
    generateDiagramTool,
    { toolName: 'generate_diagram' }
  );

  await runTest('generate_diagram', 'Code Mermaid invalide (edge)',
    { title: 'Test invalide', diagramType: 'flowchart', mermaidCode: 'sequenceDiagram\n    A -> B' },
    generateDiagramTool,
    { toolName: 'generate_diagram' },
    { expectSuccess: false }
  );

  await runTest('generate_diagram', 'Sanitize <br/> tags (edge)',
    { title: 'Test sanitize', diagramType: 'flowchart', mermaidCode: 'flowchart TD\n    A[Etape 1<br/>details] --> B[Etape 2]' },
    generateDiagramTool,
    { toolName: 'generate_diagram' }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 7. MANAGE_SKILLS
  // ═══════════════════════════════════════════
  console.log('┌─ 7. manage_skills ─────────────────────────────────');

  const skillsTool = createManageSkillsTool(fixtures.talentId);

  await runTest('manage_skills', 'Ajouter compétence catalogue (label)',
    { skillQuery: 'Rust', level: 'beginner', origin: 'inferred' },
    skillsTool,
    { toolName: 'manage_skills', args: { skillQuery: 'Rust', level: 'beginner', origin: 'inferred' } }
  );

  await runTest('manage_skills', 'Monter niveau via axes A/C/I/T',
    { skillQuery: 'Rust', level: 'advanced', origin: 'inferred', axisA: 3, axisC: 3, axisI: 3, axisT: 2 },
    skillsTool,
    { toolName: 'manage_skills', args: { skillQuery: 'Rust', level: 'advanced', origin: 'inferred' } }
  );

  await runTest('manage_skills', 'Label hors catalogue (edge) -> suggestions',
    { skillQuery: 'CompetenceQuiExistePas_9999', level: 'advanced', origin: 'declared' },
    skillsTool,
    { toolName: 'manage_skills', args: { skillQuery: 'CompetenceQuiExistePas_9999', level: 'advanced', origin: 'declared' } },
    { expectSuccess: false }
  );

  // Cleanup (remove the Rust skill row added by this audit, by resolving its slug)
  await pool.query(
    `DELETE FROM talent_skills ts USING competencies c
     WHERE ts.competency_slug = c.slug AND ts.talent_id = $1 AND lower(c.name) = 'rust'`,
    [fixtures.talentId]
  );
  console.log('  🧹 Cleaned up Rust audit skill');
  console.log('');

  // ═══════════════════════════════════════════
  // 8. EXECUTE_ACTION
  // ═══════════════════════════════════════════
  console.log('┌─ 8. execute_action ────────────────────────────────');

  const actionTool = createExecuteActionTool(fixtures.talentId);

  if (fixtures.opportunityId) {
    const alreadyApplied = await pool.query(
      `SELECT 1
       FROM opportunity_applications
       WHERE talent_id = $1 AND opportunity_id = $2
       LIMIT 1`,
      [fixtures.talentId, fixtures.opportunityId]
    );
    if (alreadyApplied.rows.length > 0) {
      results.push({ tool: 'execute_action', test: 'apply_opportunity (SKIP — already applied)', input: { action: 'apply_opportunity' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
      console.log('  ⊘ apply_opportunity (SKIP — already applied)');
    } else {
      await runTest('execute_action', 'apply_opportunity',
        { action: 'apply_opportunity', entityId: fixtures.opportunityId, dataJson: '' },
        actionTool,
        { toolName: 'execute_action', args: { action: 'apply_opportunity' } }
      );
    }
  } else {
    results.push({ tool: 'execute_action', test: 'apply_opportunity (SKIP — no opportunity)', input: { action: 'apply_opportunity' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
    console.log('  ⊘ apply_opportunity (SKIP — no opportunity)');
  }

  if (fixtures.communityId) {
    const alreadyMember = await pool.query(
      `SELECT 1
       FROM community_members
       WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [fixtures.talentId, fixtures.communityId]
    );
    if (alreadyMember.rows.length > 0) {
      results.push({ tool: 'execute_action', test: 'join_community (SKIP — already member)', input: { action: 'join_community' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
      console.log('  ⊘ join_community (SKIP — already member)');
    } else {
      await runTest('execute_action', 'join_community',
        { action: 'join_community', entityId: fixtures.communityId, dataJson: '' },
        actionTool,
        { toolName: 'execute_action', args: { action: 'join_community' } }
      );
    }
  } else {
    results.push({ tool: 'execute_action', test: 'join_community (SKIP — no community)', input: { action: 'join_community' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
    console.log('  ⊘ join_community (SKIP — no community)');
  }

  if (fixtures.spaceId) {
    await runTest('execute_action', 'book_space sans dates (edge)',
      { action: 'book_space', entityId: fixtures.spaceId, dataJson: '' },
      actionTool,
      { toolName: 'execute_action', args: { action: 'book_space' } },
      { expectSuccess: false }
    );

    await runTest('execute_action', 'book_space avec dates',
      { action: 'book_space', entityId: fixtures.spaceId, dataJson: '{"startDatetime":"2026-03-01T09:00:00Z","endDatetime":"2026-03-01T12:00:00Z"}' },
      actionTool,
      { toolName: 'execute_action', args: { action: 'book_space' } }
    );
  } else {
    results.push({ tool: 'execute_action', test: 'book_space (SKIP — no active space)', input: { action: 'book_space' }, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
    console.log('  ⊘ book_space (SKIP — no active space)');
  }

  await runTest('execute_action', 'accept_invitation inexistante (edge)',
    { action: 'accept_invitation', entityId: '00000000-0000-4000-0000-000000000000', dataJson: '' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'accept_invitation' } },
    { expectSuccess: false }
  );

  // Cleanup
  if (fixtures.spaceId) {
    await pool.query(`DELETE FROM space_bookings WHERE talent_id = $1 AND space_id = $2 AND start_datetime = '2026-03-01T09:00:00Z'`, [fixtures.talentId, fixtures.spaceId]);
    console.log('  🧹 Cleaned up test bookings');
  }
  console.log('');

  // ═══════════════════════════════════════════
  // 9. FILE_READER
  // ═══════════════════════════════════════════
  console.log('┌─ 9. file_reader (read_document) ──────────────────');
  if (!fixtures.documentId) {
    results.push({ tool: 'file_reader', test: 'Document check (SKIP — no talent document)', input: {}, output: { note: 'SKIPPED' }, summary: 'Skipped', duration: 0, status: 'SKIP' });
    console.log('  ⊘ Aucun document talent — skip');
    console.log('');
  } else {
  const docDeletedClause = await optionalNullClause('talent_documents', 'deleted_at');
  const docCheck = await pool.query(
    `SELECT id, title, mime_type, file_url
     FROM talent_documents
     WHERE id = $1 AND talent_id = $2
     ${docDeletedClause}`,
    [fixtures.documentId, fixtures.talentId]
  );
  if (docCheck.rows.length > 0) {
    const doc = docCheck.rows[0];
    console.log(`  ℹ Document: ${doc.title} (${doc.mime_type})`);
    results.push({ tool: 'file_reader', test: 'Document accessible', input: { documentId: fixtures.documentId }, output: { exists: true, title: doc.title, mimeType: doc.mime_type }, summary: `Lu · ${doc.title}`, duration: 0, status: 'PASS' });
    console.log(`  ✓ Document accessible`);
  } else {
    results.push({ tool: 'file_reader', test: 'Document check', input: { documentId: fixtures.documentId }, output: null, summary: 'Not found', duration: 0, status: 'FAIL' });
    console.log(`  ✗ Document non trouvé`);
  }
  console.log('');
  }

  // ═══════════════════════════════════════════
  // 10. WEB_SEARCH
  // ═══════════════════════════════════════════
  console.log('┌─ 10. web_search (sub-agent — skipped) ────────────');
  results.push({ tool: 'web_search', test: 'Sub-agent config', input: {}, output: { agentName: 'WebSearchAgent', model: 'vision-model', maxTurns: 5 }, summary: 'Recherche web terminée', duration: 0, status: 'SKIP' });
  console.log('  ⊘ Skipped (sub-agent handoff pattern)');
  console.log('');

  // ═══════════════════════════════════════════
  // 11. TOOL_SUMMARY VALIDATION
  // ═══════════════════════════════════════════
  console.log('┌─ 11. tool_summary ─────────────────────────────────');

  const summaryTests: Array<{toolName: string; output: any; args: any; expected: string; check: 'exact' | 'includes'}> = [
    { toolName: 'smart_search', output: { results: [{}, {}, {}], totalFound: 3 }, args: { entity: 'opportunities' }, expected: '3 résultats · opportunités', check: 'exact' },
    { toolName: 'smart_search', output: { results: [], message: 'Aucun résultat' }, args: { entity: 'talents' }, expected: 'Aucun résultat · talents', check: 'exact' },
    { toolName: 'sql_query', output: { applications: [{}, {}], totalCount: 2 }, args: { intent: 'my_applications' }, expected: 'Mes candidatures', check: 'includes' },
    { toolName: 'sql_query', output: { skills: [{}, {}, {}] }, args: { intent: 'my_skills' }, expected: 'Mes compétences', check: 'includes' },
    { toolName: 'youtube_search', output: { videos: [{}] }, args: {}, expected: '1 vidéo trouvée', check: 'exact' },
    { toolName: 'generate_document', output: { success: true, id: 'abc', metadata: { title: 'Mon CV' } }, args: {}, expected: 'Document généré', check: 'includes' },
    { toolName: 'generate_image', output: { success: true }, args: {}, expected: 'Image générée', check: 'exact' },
    { toolName: 'generate_diagram', output: { success: true }, args: {}, expected: 'Diagramme généré', check: 'exact' },
    { toolName: 'manage_skills', output: { success: true, skill: { name: 'Python', level: 'intermediate' } }, args: { skillQuery: 'Python' }, expected: 'Compétence · Python (intermediate)', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'apply_opportunity' }, expected: 'Candidature soumise', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'join_community' }, expected: 'Communauté rejointe', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'book_space' }, expected: 'Espace réservé', check: 'exact' },
  ];

  for (const st of summaryTests) {
    const summary = generateToolSummary(st.toolName, st.output, false, st.args);
    const pass = st.check === 'exact' ? summary === st.expected : summary.includes(st.expected);
    const label = st.args?.intent || st.args?.action || st.args?.entity || '';
    console.log(`  ${pass ? '✓' : '✗'} ${st.toolName}(${label}) → "${summary}" ${!pass ? `(expected: "${st.expected}")` : ''}`);
    results.push({ tool: 'tool_summary', test: `${st.toolName}(${label}) summary`, input: st.args, output: { summary, expected: st.expected }, summary, duration: 0, status: pass ? 'PASS' : 'FAIL' });
  }

  console.log('');

  // ═══════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║  Total: ${total} | ✓ Pass: ${passed} | ✗ Fail: ${failed} | ⊘ Skip: ${skipped}`);
  console.log('╚══════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n── ÉCHECS ──');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ [${r.tool}] ${r.test}`);
      if (r.error) console.log(`    Error: ${r.error}`);
      console.log(`    Output: ${JSON.stringify(r.output)?.slice(0, 300)}`);
    });
  }

  // Write full results JSON
  const outputPath = `${__dirname}/tools-audit-results.json`;
  const fs = await import('fs');
  const slow = results.filter(r => r.duration > 1000).sort((a, b) => b.duration - a.duration).slice(0, 10);
  const heavy = results.filter(r => (r.outputBytes || 0) > 6000).sort((a, b) => (b.outputBytes || 0) - (a.outputBytes || 0)).slice(0, 10);
  const byTool = new Map<string, { count: number; failed: number; skipped: number; duration: number; bytes: number }>();
  for (const r of results) {
    const current = byTool.get(r.tool) || { count: 0, failed: 0, skipped: 0, duration: 0, bytes: 0 };
    current.count++;
    if (r.status === 'FAIL') current.failed++;
    if (r.status === 'SKIP') current.skipped++;
    current.duration += r.duration;
    current.bytes += r.outputBytes || 0;
    byTool.set(r.tool, current);
  }

  fs.writeFileSync(outputPath, JSON.stringify({
    auditDate: new Date().toISOString(),
    fixture: fixtures,
    summary: { total, passed, failed, skipped },
    results: results.map(r => ({
      ...r,
      output: typeof r.output === 'object' ? r.output : { raw: r.output }
    }))
  }, null, 2));
  console.log(`\n📄 Full results: ${outputPath}`);

  const mdPath = path.resolve(__dirname, '../../../../../../docs/copilot-tools-audit.md');
  let md = `# Copilot Tools Audit\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Fixture talent: \`${fixtures.talentId}\` (preferred slug: \`${PREFERRED_TALENT_SLUG}\`)\n\n`;
  md += `## Summary\n\n`;
  md += `| Total | Passed | Failed | Skipped |\n|---:|---:|---:|---:|\n| ${total} | ${passed} | ${failed} | ${skipped} |\n\n`;
  md += `## By Tool\n\n`;
  md += `| Tool | Tests | Failed | Skipped | Total ms | Avg ms | Output KB |\n|---|---:|---:|---:|---:|---:|---:|\n`;
  for (const [tool, s] of [...byTool.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `| ${tool} | ${s.count} | ${s.failed} | ${s.skipped} | ${s.duration} | ${Math.round(s.duration / Math.max(s.count, 1))} | ${(s.bytes / 1024).toFixed(1)} |\n`;
  }
  md += `\n## Slowest Calls\n\n`;
  md += `| Tool | Test | Status | Duration ms | Output KB | Summary |\n|---|---|---|---:|---:|---|\n`;
  for (const r of slow) {
    md += `| ${r.tool} | ${r.test.replace(/\|/g, '/')} | ${r.status} | ${r.duration} | ${((r.outputBytes || 0) / 1024).toFixed(1)} | ${r.summary.replace(/\|/g, '/')} |\n`;
  }
  md += `\n## Heaviest Outputs\n\n`;
  md += `| Tool | Test | Status | Output KB | Keys |\n|---|---|---|---:|---|\n`;
  for (const r of heavy) {
    md += `| ${r.tool} | ${r.test.replace(/\|/g, '/')} | ${r.status} | ${((r.outputBytes || 0) / 1024).toFixed(1)} | ${(r.outputKeys || []).join(', ')} |\n`;
  }
  md += `\n## Failed Tests\n\n`;
  const failedRows = results.filter(r => r.status === 'FAIL');
  if (failedRows.length === 0) {
    md += `No failing tool tests.\n`;
  } else {
    for (const r of failedRows) {
      md += `- **${r.tool} / ${r.test}**: ${r.error || 'failed'}\n`;
    }
  }
  fs.writeFileSync(mdPath, md);
  console.log(`📄 Markdown report: ${mdPath}`);

  await cleanupAuditGeneratedDocuments(fixtures.talentId);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
})();
