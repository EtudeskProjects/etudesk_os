/**
 * TOOLS AUDIT — Real integration tests
 * Tests every copilot tool with real DB/API data and captures actual outputs
 * Run: npx tsx src/services/copilot/tools/__tests__/tools-audit.ts
 */

import 'dotenv/config';
import { pool } from '../../../database';
import { vectorQueryTool } from '../vector-query.tool';
import { createSqlQueryTool } from '../sql-query.tool';
import { youtubeSearchTool } from '../youtube-search.tool';
import { createGenerateDocumentTool } from '../generate-document.tool';
import { generateImageTool } from '../generate-image.tool';
import { generateDiagramTool } from '../generate-diagram.tool';
import { createManageSkillsTool } from '../manage-skills.tool';
import { createExecuteActionTool } from '../execute-action.tool';
import { generateToolSummary } from '../../stream/tool-summary';

// Test constants
const TALENT_ID = '689f7929-7c13-4103-b119-09a806836347'; // Lamine
const ORG_ID = '6a80d332-9d56-489c-8314-b65746b4cd78';
const DOCUMENT_ID = '483bdc16-fba3-4a10-aa4e-79b716595fcc';
const OPPORTUNITY_ID = 'c0000001-0002-4000-c000-000000000002';
const COMMUNITY_ID = 'e0000001-0002-4000-e000-000000000002';
const SPACE_ID = 'f0000001-0002-4000-f000-000000000002';

interface TestResult {
  tool: string;
  test: string;
  input: any;
  output: any;
  summary: string;
  duration: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
}

const results: TestResult[] = [];

/**
 * OpenAI Agents SDK tool.invoke(context, inputJsonString)
 * context = {} (empty for standalone tests)
 * inputJsonString = JSON.stringify(params)
 */
async function invokeTool(toolObj: any, params: Record<string, any>): Promise<any> {
  const raw = await toolObj.invoke({}, JSON.stringify(params));
  // invoke returns a string — parse it back to object
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function runTest(
  tool: string,
  test: string,
  params: any,
  toolObj: any,
  summaryArgs?: { toolName: string; args?: Record<string, unknown> }
): Promise<void> {
  const start = Date.now();
  try {
    const output = await invokeTool(toolObj, params);
    const duration = Date.now() - start;
    const sArgs = summaryArgs || { toolName: tool };
    const summary = generateToolSummary(sArgs.toolName, output, false, sArgs.args || params);
    results.push({ tool, test, input: params, output, summary, duration, status: 'PASS' });
    console.log(`  ✓ ${test} (${duration}ms) → summary: "${summary}"`);
  } catch (err: any) {
    const duration = Date.now() - start;
    const summary = generateToolSummary(tool, err.message, true);
    results.push({ tool, test, input: params, output: null, summary, duration, status: 'FAIL', error: err.message });
    console.log(`  ✗ ${test} (${duration}ms) → ERROR: ${err.message?.slice(0, 150)}`);
  }
}

(async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         ETUDESK COPILOT TOOLS — AUDIT RÉEL          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════
  // 1. VECTOR_QUERY
  // ═══════════════════════════════════════════
  console.log('┌─ 1. vector_query ──────────────────────────────────');

  await runTest('vector_query', 'Recherche opportunités dev React Abidjan',
    { query: 'développeur React Node.js Abidjan', namespace: 'opportunities', topK: 5, filtersJson: null },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'opportunities' } }
  );

  await runTest('vector_query', 'Recherche talents fullstack',
    { query: 'développeur fullstack Python Django', namespace: 'talents', topK: 5, filtersJson: null },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'talents' } }
  );

  await runTest('vector_query', 'Recherche communautés tech',
    { query: 'communauté startup tech innovation', namespace: 'communities', topK: 5, filtersJson: null },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'communities' } }
  );

  await runTest('vector_query', 'Recherche espaces coworking',
    { query: 'espace coworking salle réunion', namespace: 'spaces', topK: 5, filtersJson: null },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'spaces' } }
  );

  await runTest('vector_query', 'Recherche organisations fintech',
    { query: 'fintech paiement mobile Afrique', namespace: 'organizations', topK: 5, filtersJson: null },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'organizations' } }
  );

  await runTest('vector_query', 'Avec filtre contract_type CDI',
    { query: 'emploi marketing digital', namespace: 'opportunities', topK: 5, filtersJson: '{"contract_type":"CDI"}' },
    vectorQueryTool,
    { toolName: 'vector_query', args: { namespace: 'opportunities' } }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 2. SQL_QUERY
  // ═══════════════════════════════════════════
  console.log('┌─ 2. sql_query ─────────────────────────────────────');

  const sqlTool = createSqlQueryTool(TALENT_ID, [ORG_ID]);

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
  const orgIntents = ['org_stats', 'org_members', 'org_opportunities', 'org_communities', 'org_spaces', 'org_revenue', 'org_invitations'];
  for (const intent of orgIntents) {
    await runTest('sql_query', intent,
      { intent, paramsJson: JSON.stringify({ organizationId: ORG_ID }) },
      sqlTool,
      { toolName: 'sql_query', args: { intent } }
    );
  }

  // org_applications
  await runTest('sql_query', 'org_applications',
    { intent: 'org_applications', paramsJson: JSON.stringify({ organizationId: ORG_ID }) },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'org_applications' } }
  );

  // Search intents
  await runTest('sql_query', 'search_opportunities (React)',
    { intent: 'search_opportunities', paramsJson: '{"query":"React","limit":5}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'search_opportunities' } }
  );

  await runTest('sql_query', 'search_communities (tech)',
    { intent: 'search_communities', paramsJson: '{"query":"tech","limit":5}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'search_communities' } }
  );

  await runTest('sql_query', 'search_spaces (coworking)',
    { intent: 'search_spaces', paramsJson: '{"query":"coworking","limit":5}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'search_spaces' } }
  );

  await runTest('sql_query', 'search_organizations (tech)',
    { intent: 'search_organizations', paramsJson: '{"query":"tech","limit":5}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'search_organizations' } }
  );

  await runTest('sql_query', 'search_talents (développeur)',
    { intent: 'search_talents', paramsJson: '{"query":"développeur","limit":5}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'search_talents' } }
  );

  // Edge: org intent without orgId
  await runTest('sql_query', 'org_stats sans organizationId (edge)',
    { intent: 'org_stats', paramsJson: '{}' },
    sqlTool,
    { toolName: 'sql_query', args: { intent: 'org_stats' } }
  );

  // Edge: restricted intent in study mode
  const studySqlTool = createSqlQueryTool(TALENT_ID, [ORG_ID], ['my_profile', 'my_skills', 'my_documents'] as any);
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

  await runTest('youtube_search', 'Entrepreneuriat Afrique',
    { query: 'entrepreneuriat startup Afrique francophone', maxResults: 2 },
    youtubeSearchTool,
    { toolName: 'youtube_search' }
  );

  await runTest('youtube_search', 'Sujet niche UEMOA',
    { query: 'mobile money API integration UEMOA', maxResults: 1 },
    youtubeSearchTool,
    { toolName: 'youtube_search' }
  );

  console.log('');

  // ═══════════════════════════════════════════
  // 4. GENERATE_DOCUMENT
  // ═══════════════════════════════════════════
  console.log('┌─ 4. generate_document ─────────────────────────────');

  const genDocTool = createGenerateDocumentTool(TALENT_ID);

  await runTest('generate_document', 'PDF Sections (lettre motivation)',
    { format: 'PDF', title: 'Lettre de Motivation', contentJson: '{"sections":[{"heading":"Objet","body":"Candidature au poste de développeur fullstack."},{"heading":"Compétences","body":"5 ans en React, Node.js et PostgreSQL."}]}', instructions: 'Lettre de motivation formelle' },
    genDocTool,
    { toolName: 'generate_document' }
  );

  await runTest('generate_document', 'DOCX Table (export données)',
    { format: 'DOCX', title: 'Export Talents', contentJson: '{"headers":["Nom","Ville","Compétence"],"rows":[["Lamine Barro","Abidjan","React"],["Estelle Traoré","Abidjan","Python"]]}', instructions: 'Export tableau des talents' },
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
      firstName: 'Lamine', lastName: 'Barro', email: 'lamine@etudesk.com', phone: '+225 07 00 00 00',
      city: 'Abidjan', country: 'Cote d\'Ivoire', bio: 'Fondateur & CEO Etudesk.',
      skills: [{ name: 'React', type: 'hard', level: 'expert' }, { name: 'Node.js', type: 'hard', level: 'advanced' }],
      languages: [{ language: 'Francais', level: 'native' }],
      experiences: [{ title: 'CEO', company: 'Etudesk', location: 'Abidjan', period: '2020 - Present', description: 'Direction plateforme.' }],
      education: [{ degree: 'Master Informatique', institution: 'ESATIC', location: 'Abidjan', period: '2016 - 2018' }]
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
    { toolName: 'generate_diagram' }
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

  const skillsTool = createManageSkillsTool(TALENT_ID);

  await runTest('manage_skills', 'Ajouter compétence Rust',
    { action: 'add', skillName: 'Rust_Audit_Test', proficiencyLevel: 'BEGINNER', origin: 'AI_INFERRED' },
    skillsTool,
    { toolName: 'manage_skills', args: { action: 'add', skillName: 'Rust_Audit_Test', proficiencyLevel: 'BEGINNER', origin: 'AI_INFERRED', is_visible: true } }
  );

  await runTest('manage_skills', 'Update compétence Rust -> INTERMEDIATE',
    { action: 'update', skillName: 'Rust_Audit_Test', proficiencyLevel: 'INTERMEDIATE', origin: 'AI_INFERRED' },
    skillsTool,
    { toolName: 'manage_skills', args: { action: 'update', skillName: 'Rust_Audit_Test', proficiencyLevel: 'INTERMEDIATE', origin: 'AI_INFERRED', is_visible: true } }
  );

  await runTest('manage_skills', 'Ajouter doublon (edge)',
    { action: 'add', skillName: 'Rust_Audit_Test', proficiencyLevel: 'EXPERT', origin: 'SELF_DECLARED' },
    skillsTool,
    { toolName: 'manage_skills', args: { action: 'add', skillName: 'Rust_Audit_Test', proficiencyLevel: 'EXPERT', origin: 'SELF_DECLARED', is_visible: true } }
  );

  await runTest('manage_skills', 'Update inexistant (edge)',
    { action: 'update', skillName: 'CompetenceQuiExistePas_9999', proficiencyLevel: 'EXPERT', origin: 'SELF_DECLARED' },
    skillsTool,
    { toolName: 'manage_skills', args: { action: 'update', skillName: 'CompetenceQuiExistePas_9999', proficiencyLevel: 'EXPERT', origin: 'SELF_DECLARED', is_visible: true } }
  );

  // Cleanup
  await pool.query(`DELETE FROM talent_skills WHERE talent_id = $1 AND canonical_name = 'Rust_Audit_Test'`, [TALENT_ID]);
  console.log('  🧹 Cleaned up Rust_Audit_Test');
  console.log('');

  // ═══════════════════════════════════════════
  // 8. EXECUTE_ACTION
  // ═══════════════════════════════════════════
  console.log('┌─ 8. execute_action ────────────────────────────────');

  const actionTool = createExecuteActionTool(TALENT_ID);

  await runTest('execute_action', 'apply_opportunity',
    { action: 'apply_opportunity', entityId: OPPORTUNITY_ID, dataJson: '' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'apply_opportunity' } }
  );

  await runTest('execute_action', 'join_community',
    { action: 'join_community', entityId: COMMUNITY_ID, dataJson: '' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'join_community' } }
  );

  await runTest('execute_action', 'book_space sans dates (edge)',
    { action: 'book_space', entityId: SPACE_ID, dataJson: '' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'book_space' } }
  );

  await runTest('execute_action', 'book_space avec dates',
    { action: 'book_space', entityId: SPACE_ID, dataJson: '{"startDatetime":"2026-03-01T09:00:00Z","endDatetime":"2026-03-01T12:00:00Z"}' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'book_space' } }
  );

  await runTest('execute_action', 'accept_invitation inexistante (edge)',
    { action: 'accept_invitation', entityId: '00000000-0000-4000-0000-000000000000', dataJson: '' },
    actionTool,
    { toolName: 'execute_action', args: { action: 'accept_invitation' } }
  );

  // Cleanup
  await pool.query(`DELETE FROM space_bookings WHERE talent_id = $1 AND space_id = $2 AND start_datetime = '2026-03-01T09:00:00Z'`, [TALENT_ID, SPACE_ID]);
  console.log('  🧹 Cleaned up test bookings');
  console.log('');

  // ═══════════════════════════════════════════
  // 9. FILE_READER
  // ═══════════════════════════════════════════
  console.log('┌─ 9. file_reader (read_document) ──────────────────');
  const docCheck = await pool.query(
    `SELECT id, title, mime_type, file_url FROM talent_documents WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL`,
    [DOCUMENT_ID, TALENT_ID]
  );
  if (docCheck.rows.length > 0) {
    const doc = docCheck.rows[0];
    console.log(`  ℹ Document: ${doc.title} (${doc.mime_type})`);
    results.push({ tool: 'file_reader', test: 'Document accessible', input: { documentId: DOCUMENT_ID }, output: { exists: true, title: doc.title, mimeType: doc.mime_type }, summary: `Lu · ${doc.title}`, duration: 0, status: 'PASS' });
    console.log(`  ✓ Document accessible`);
  } else {
    results.push({ tool: 'file_reader', test: 'Document check', input: { documentId: DOCUMENT_ID }, output: null, summary: 'Not found', duration: 0, status: 'FAIL' });
    console.log(`  ✗ Document non trouvé`);
  }
  console.log('');

  // ═══════════════════════════════════════════
  // 10. WEB_SEARCH
  // ═══════════════════════════════════════════
  console.log('┌─ 10. web_search (sub-agent — skipped) ────────────');
  results.push({ tool: 'web_search', test: 'Sub-agent config', input: {}, output: { agentName: 'WebSearchAgent', model: 'gpt-5-mini', maxTurns: 5 }, summary: 'Recherche web terminée', duration: 0, status: 'SKIP' });
  console.log('  ⊘ Skipped (sub-agent handoff pattern)');
  console.log('');

  // ═══════════════════════════════════════════
  // 11. TOOL_SUMMARY VALIDATION
  // ═══════════════════════════════════════════
  console.log('┌─ 11. tool_summary ─────────────────────────────────');

  const summaryTests: Array<{toolName: string; output: any; args: any; expected: string; check: 'exact' | 'includes'}> = [
    { toolName: 'vector_query', output: { results: [{}, {}, {}], totalFound: 3 }, args: { namespace: 'opportunities' }, expected: '3 résultats · opportunités', check: 'exact' },
    { toolName: 'vector_query', output: { results: [], message: 'Aucun résultat' }, args: { namespace: 'talents' }, expected: 'Aucun résultat · talents', check: 'exact' },
    { toolName: 'sql_query', output: { applications: [{}, {}], totalCount: 2 }, args: { intent: 'my_applications' }, expected: 'Mes candidatures', check: 'includes' },
    { toolName: 'sql_query', output: { skills: [{}, {}, {}] }, args: { intent: 'my_skills' }, expected: 'Mes compétences', check: 'includes' },
    { toolName: 'youtube_search', output: { videos: [{}] }, args: {}, expected: '1 vidéo trouvée', check: 'exact' },
    { toolName: 'generate_document', output: { success: true, id: 'abc', metadata: { title: 'Mon CV' } }, args: {}, expected: 'Document généré', check: 'includes' },
    { toolName: 'generate_image', output: { success: true }, args: {}, expected: 'Image générée', check: 'exact' },
    { toolName: 'generate_diagram', output: { success: true }, args: {}, expected: 'Diagramme généré', check: 'exact' },
    { toolName: 'manage_skills', output: { success: true }, args: { action: 'add', skillName: 'Python' }, expected: 'Ajoutée · Python', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'apply_opportunity' }, expected: 'Candidature soumise', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'join_community' }, expected: 'Communauté rejointe', check: 'exact' },
    { toolName: 'execute_action', output: { success: true }, args: { action: 'book_space' }, expected: 'Espace réservé', check: 'exact' },
  ];

  for (const st of summaryTests) {
    const summary = generateToolSummary(st.toolName, st.output, false, st.args);
    const pass = st.check === 'exact' ? summary === st.expected : summary.includes(st.expected);
    const label = st.args?.intent || st.args?.action || st.args?.namespace || '';
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
  fs.writeFileSync(outputPath, JSON.stringify({
    auditDate: new Date().toISOString(),
    summary: { total, passed, failed, skipped },
    results: results.map(r => ({
      ...r,
      output: typeof r.output === 'object' ? r.output : { raw: r.output }
    }))
  }, null, 2));
  console.log(`\n📄 Full results: ${outputPath}`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
})();
