/**
 * Copilot Agent Integration Tests
 * Tests Explorer and Study agent outputs for a test talent
 *
 * Usage: npx tsx src/tests/copilot-agents.test.ts
 */

import 'dotenv/config';
import { run } from '@openai/agents';
import type { Agent } from '@openai/agents';
import { pool } from '../services/database';
import { graphService } from '../services/graph';
import { neo4jClient } from '../services/graph/neo4j.client';
import { createTalentAgent } from '../services/copilot/agents/talent.agent';
import type { TalentContext } from '../services/copilot/types';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color: keyof typeof COLORS, ...args: any[]) {
  console.log(COLORS[color], ...args, COLORS.reset);
}

function header(title: string) {
  console.log('\n' + '═'.repeat(70));
  log('bold', `  ${title}`);
  console.log('═'.repeat(70));
}

function section(title: string) {
  console.log('\n' + '─'.repeat(50));
  log('cyan', `  ${title}`);
  console.log('─'.repeat(50));
}

// ═══════════════════════════════════════════════════════════════
// TEST TALENT SETUP
// ═══════════════════════════════════════════════════════════════

interface TestTalent {
  id: string;
  name: string;
}

async function findOrCreateTestTalent(): Promise<TestTalent> {
  // Find an existing talent with the most skills (richest data)
  const existing = await pool.query(`
    SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
    FROM talents t
    WHERE t.deleted_at IS NULL
    ORDER BY (
      SELECT COUNT(*) FROM talent_skills ts WHERE ts.talent_id = t.id
    ) DESC
    LIMIT 1
  `);

  if (existing.rows.length > 0) {
    const t = existing.rows[0];
    log('green', `✓ Using existing talent: ${t.display_name} (${t.id})`);
    return { id: t.id, name: t.display_name };
  }

  throw new Error('No talent found in database. Run seed first: npm run seed');
}

async function buildTestContext(talentId: string): Promise<TalentContext> {
  // Load talent profile
  const profileRes = await pool.query(`
    SELECT t.id, t.first_name, t.last_name, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio as headline,
           t.city, t.country, t.email
    FROM talents t
    WHERE t.id = $1
  `, [talentId]);

  const profile = profileRes.rows[0];
  if (!profile) throw new Error(`Talent ${talentId} not found`);

  // Load skills
  const skillsRes = await pool.query(`
    SELECT canonical_name as name, proficiency_level as level
    FROM talent_skills
    WHERE talent_id = $1
  `, [talentId]);

  // Load languages (table may not exist)
  const langsRes = await pool.query(`
    SELECT language, proficiency_level as level FROM talent_languages WHERE talent_id = $1
  `, [talentId]).catch(() => ({ rows: [] }));

  // Load documents count
  const docsRes = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE document_type IN ('cv', 'resume')) as cv_count,
           COUNT(*) FILTER (WHERE document_type IN ('diploma', 'degree')) as diploma_count
    FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL
  `, [talentId]).catch(() => ({ rows: [{ total: 0, cv_count: 0, diploma_count: 0 }] }));

  // Load applications count
  const appsRes = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status NOT IN ('REJECTED', 'WITHDRAWN', 'CLOSED')) as active
    FROM opportunity_applications WHERE talent_id = $1
  `, [talentId]).catch(() => ({ rows: [{ total: 0, active: 0 }] }));

  // Load memberships
  const membRes = await pool.query(`
    SELECT COUNT(*) as total FROM community_members
    WHERE talent_id = $1 AND status = 'ACTIVE'
  `, [talentId]).catch(() => ({ rows: [{ total: 0 }] }));

  // Load learning
  const learnRes = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM learning_topics WHERE talent_id = $1) as topics,
      (SELECT COUNT(*) FROM learning_flashcards lf JOIN learning_topics lt ON lf.topic_id = lt.id WHERE lt.talent_id = $1) as flashcards,
      (SELECT COUNT(*) FROM learning_flashcards lf JOIN learning_topics lt ON lf.topic_id = lt.id WHERE lt.talent_id = $1 AND lf.next_review_at <= CURRENT_DATE) as due,
      0 as streak
  `, [talentId]).catch(() => ({ rows: [{ topics: 0, flashcards: 0, due: 0, streak: 0 }] }));

  // Check graph availability
  let graphAvailable = false;
  let skillGaps: Array<{ skillName: string; priority: string }> = [];
  try {
    if (neo4jClient.isConnected()) {
      graphAvailable = true;
      const gaps = await graphService.getSkillGaps(talentId, { limit: 5 });
      skillGaps = gaps.map(g => ({
        skillName: g.skill?.canonical_name || 'unknown',
        priority: g.priority,
      }));
    }
  } catch {
    // Graph not available
  }

  const docs = docsRes.rows[0];
  const apps = appsRes.rows[0];
  const memb = membRes.rows[0];
  const learn = learnRes.rows[0];

  return {
    talentId,
    talentName: profile.display_name || `${profile.first_name} ${profile.last_name}`,
    profile: {
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      city: profile.city,
      country: profile.country,
      remotePreference: 'ANY',
      skills: skillsRes.rows.map(s => ({ name: s.name, level: s.level })),
      languages: langsRes.rows.map(l => ({ language: l.language, level: l.level })),
    },
    documents: {
      totalCount: parseInt(docs.total) || 0,
      hasCV: parseInt(docs.cv_count) > 0,
      hasDiplomas: parseInt(docs.diploma_count) > 0,
    },
    applications: {
      totalCount: parseInt(apps.total) || 0,
      activeCount: parseInt(apps.active) || 0,
    },
    memberships: {
      totalCount: parseInt(memb.total) || 0,
    },
    learning: {
      totalTopics: parseInt(learn.topics) || 0,
      totalFlashcards: parseInt(learn.flashcards) || 0,
      dueFlashcards: parseInt(learn.due) || 0,
      streakDays: parseInt(learn.streak) || 0,
    },
    graph: {
      isGraphAvailable: graphAvailable,
      skillGaps,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT TEST RUNNER
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  testName: string;
  mode: 'explorer' | 'study';
  message: string;
  success: boolean;
  output: string;
  toolCalls: Array<{ name: string; args?: any; output?: string; error?: string }>;
  duration: number;
  errors: string[];
  warnings: string[];
}

async function runAgentTest(
  agent: Agent,
  testName: string,
  mode: 'explorer' | 'study',
  message: string
): Promise<TestResult> {
  const start = Date.now();
  const toolCalls: TestResult['toolCalls'] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let output = '';

  section(`TEST: ${testName}`);
  log('dim', `Mode: ${mode} | Message: "${message}"`);

  try {
    const result = await run(agent, message, { stream: true });

    for await (const event of result as AsyncIterable<any>) {
      // Capture text deltas
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as any;
        if (data?.type === 'output_text_delta') {
          output += data.delta as string;
        }
      }

      // Capture tool calls
      if (event.type === 'run_item_stream_event') {
        const item = event.item as any;

        if (event.name === 'tool_called') {
          const toolName = item?.call?.name || item?.name || 'unknown';
          const toolArgs = item?.call?.args || item?.arguments;
          log('blue', `  🔧 Tool called: ${toolName}`);
          if (toolArgs) {
            try {
              const parsed = typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs;
              log('dim', `     Args: ${JSON.stringify(parsed, null, 2).slice(0, 200)}`);
            } catch {
              log('dim', `     Args: ${String(toolArgs).slice(0, 200)}`);
            }
          }
          toolCalls.push({ name: toolName, args: toolArgs });
        }

        if (event.name === 'tool_output') {
          const toolName = item?.call?.name || item?.name || 'unknown';
          const toolOutput = item?.output;
          const lastCall = [...toolCalls].reverse().find((tc: { name: string }) => tc.name === toolName);

          if (typeof toolOutput === 'string' && toolOutput.includes('error')) {
            try {
              const parsed = JSON.parse(toolOutput);
              if (parsed.error) {
                errors.push(`Tool ${toolName}: ${parsed.error}`);
                log('red', `  ✗ Tool error: ${toolName} → ${parsed.error}`);
              }
            } catch {
              // Not JSON error, ignore
            }
          }

          if (lastCall) {
            lastCall.output = typeof toolOutput === 'string'
              ? toolOutput.slice(0, 300)
              : JSON.stringify(toolOutput).slice(0, 300);
          }

          log('green', `  ✓ Tool output: ${toolName} (${String(toolOutput).slice(0, 100)}...)`);
        }
      }
    }

    // Fallback capture
    await (result as any).completed;
    if (!output && (result as any).finalOutput) {
      output = typeof (result as any).finalOutput === 'string'
        ? (result as any).finalOutput
        : JSON.stringify((result as any).finalOutput);
    }
  } catch (error: any) {
    errors.push(`Agent execution error: ${error.message}`);
    log('red', `  ✗ AGENT ERROR: ${error.message}`);
  }

  const duration = Date.now() - start;

  // ─── OUTPUT AUDIT ──────────────────────────────────────────
  log('yellow', `\n  📝 Output (${output.length} chars, ${duration}ms):`);
  console.log('  ' + output.slice(0, 500));
  if (output.length > 500) log('dim', `  ... (${output.length - 500} more chars)`);

  // Audit checks
  if (!output || output.length === 0) {
    errors.push('Empty output');
  }
  if (output.length < 20) {
    warnings.push(`Very short output: ${output.length} chars`);
  }

  // Check for French
  const frenchIndicators = ['je ', 'de ', 'les ', 'des ', 'une ', 'est ', 'pour ', 'avec ', 'dans '];
  const hasFrench = frenchIndicators.some(w => output.toLowerCase().includes(w));
  if (!hasFrench && output.length > 50) {
    warnings.push('Output may not be in French');
  }

  // Check for entity cards (Explorer mode)
  if (mode === 'explorer') {
    const entityCardPattern = /```entity:\w+/g;
    const entityCards = output.match(entityCardPattern);
    if (entityCards) {
      log('green', `  ✓ Entity cards found: ${entityCards.length}`);
    }
  }

  // Check for study blocks (Study mode)
  if (mode === 'study') {
    const studyPatterns = [
      { name: 'quiz', pattern: /```quiz/g },
      { name: 'flashcard', pattern: /```flashcard/g },
      { name: 'diagram', pattern: /```(mermaid|diagram)/g },
      { name: 'youtube', pattern: /```youtube/g },
      { name: 'code', pattern: /```(\w+)\n/g },
    ];
    for (const sp of studyPatterns) {
      const matches = output.match(sp.pattern);
      if (matches) {
        log('green', `  ✓ ${sp.name} blocks: ${matches.length}`);
      }
    }
  }

  // Check tool usage
  if (toolCalls.length === 0 && output.length > 100) {
    warnings.push('No tool calls made — agent may not be using tools');
  }

  // Report
  const success = errors.length === 0;
  if (success) {
    log('green', `\n  ✅ PASS (${duration}ms, ${toolCalls.length} tool calls)`);
  } else {
    log('red', `\n  ❌ FAIL (${errors.length} errors)`);
    errors.forEach(e => log('red', `     - ${e}`));
  }
  if (warnings.length > 0) {
    warnings.forEach(w => log('yellow', `  ⚠ ${w}`));
  }

  return { testName, mode, message, success, output, toolCalls, duration, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════

async function runExplorerTests(context: TalentContext): Promise<TestResult[]> {
  header('EXPLORER AGENT TESTS');
  const agent = createTalentAgent('explorer', context);
  const results: TestResult[] = [];

  const tests = [
    {
      name: 'Profile Summary',
      message: `Résume mon profil et mes compétences principales. Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Opportunity Search',
      message: `Cherche des opportunités qui correspondent à mon profil. Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Skill Gaps',
      message: `Quelles compétences me manquent pour les opportunités du marché ? Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Community Discovery',
      message: `Quelles communautés me recommandes-tu de rejoindre ? Mon talentId est ${context.talentId}.`,
    },
  ];

  for (const test of tests) {
    try {
      const result = await runAgentTest(agent, test.name, 'explorer', test.message);
      results.push(result);
    } catch (error: any) {
      log('red', `  ✗ Test "${test.name}" crashed: ${error.message}`);
      results.push({
        testName: test.name,
        mode: 'explorer',
        message: test.message,
        success: false,
        output: '',
        toolCalls: [],
        duration: 0,
        errors: [`Crash: ${error.message}`],
        warnings: [],
      });
    }
  }

  return results;
}

async function runStudyTests(context: TalentContext): Promise<TestResult[]> {
  header('STUDY AGENT TESTS');
  const agent = createTalentAgent('study', context);
  const results: TestResult[] = [];

  // Pick a skill from context for study tests
  const skillName = context.profile.skills[0]?.name || 'JavaScript';

  const tests = [
    {
      name: 'Learning Progress',
      message: `Quel est mon progrès d'apprentissage ? Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Teach Concept',
      message: `Explique-moi les concepts fondamentaux de ${skillName}. Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Quiz Generation',
      message: `Fais-moi un quiz sur ${skillName} pour tester mes connaissances. Mon talentId est ${context.talentId}.`,
    },
    {
      name: 'Learning Path',
      message: `Quel chemin d'apprentissage me recommandes-tu pour devenir expert en ${skillName} ? Mon talentId est ${context.talentId}.`,
    },
  ];

  for (const test of tests) {
    try {
      const result = await runAgentTest(agent, test.name, 'study', test.message);
      results.push(result);
    } catch (error: any) {
      log('red', `  ✗ Test "${test.name}" crashed: ${error.message}`);
      results.push({
        testName: test.name,
        mode: 'study',
        message: test.message,
        success: false,
        output: '',
        toolCalls: [],
        duration: 0,
        errors: [`Crash: ${error.message}`],
        warnings: [],
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// AUDIT REPORT
// ═══════════════════════════════════════════════════════════════

function printAuditReport(results: TestResult[]) {
  header('AUDIT REPORT');

  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / total);

  log('bold', `  Total: ${total} | Passed: ${passed} | Failed: ${failed} | Warnings: ${totalWarnings}`);
  log('dim', `  Average duration: ${avgDuration}ms`);

  // Tool usage summary
  section('Tool Usage Summary');
  const toolStats = new Map<string, { calls: number; errors: number }>();
  for (const r of results) {
    for (const tc of r.toolCalls) {
      const stats = toolStats.get(tc.name) || { calls: 0, errors: 0 };
      stats.calls++;
      if (tc.error) stats.errors++;
      toolStats.set(tc.name, stats);
    }
  }
  for (const [name, stats] of toolStats) {
    const statusIcon = stats.errors > 0 ? '⚠' : '✓';
    log(stats.errors > 0 ? 'yellow' : 'green',
      `  ${statusIcon} ${name}: ${stats.calls} calls, ${stats.errors} errors`
    );
  }

  // Failed tests details
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    section('Failed Tests');
    for (const r of failedTests) {
      log('red', `  ✗ [${r.mode}] ${r.testName}`);
      r.errors.forEach(e => log('red', `    - ${e}`));
    }
  }

  // Warnings
  const warningTests = results.filter(r => r.warnings.length > 0);
  if (warningTests.length > 0) {
    section('Warnings');
    for (const r of warningTests) {
      log('yellow', `  ⚠ [${r.mode}] ${r.testName}`);
      r.warnings.forEach(w => log('yellow', `    - ${w}`));
    }
  }

  // Output quality audit
  section('Output Quality Audit');
  for (const r of results) {
    const outputLen = r.output.length;
    const quality = outputLen === 0 ? 'EMPTY' :
      outputLen < 50 ? 'TOO_SHORT' :
      outputLen > 3000 ? 'VERBOSE' : 'OK';
    const icon = quality === 'OK' ? '✓' : quality === 'VERBOSE' ? '⚠' : '✗';
    const color = quality === 'OK' ? 'green' : quality === 'VERBOSE' ? 'yellow' : 'red';
    log(color, `  ${icon} [${r.mode}] ${r.testName}: ${outputLen} chars (${quality}), ${r.duration}ms`);
  }

  // Final summary
  console.log('\n' + '═'.repeat(70));
  if (failed === 0) {
    log('green', `  ✅ ALL ${total} TESTS PASSED`);
  } else {
    log('red', `  ❌ ${failed}/${total} TESTS FAILED`);
  }
  console.log('═'.repeat(70) + '\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  header('COPILOT AGENT INTEGRATION TESTS');
  log('dim', `  Date: ${new Date().toISOString()}`);
  log('dim', `  OpenAI Key: ${process.env.OPENAI_API_KEY ? '✓ set' : '✗ missing'}`);
  log('dim', `  Pinecone Key: ${process.env.PINECONE_API_KEY ? '✓ set' : '✗ missing'}`);

  if (!process.env.OPENAI_API_KEY) {
    log('red', '\n  ✗ OPENAI_API_KEY not set. Cannot run agent tests.');
    process.exit(1);
  }

  try {
    // Initialize graph if available
    try {
      await graphService.initialize();
      log('green', '  ✓ Neo4j connected');
    } catch {
      log('yellow', '  ⚠ Neo4j not available — graph tools will fail gracefully');
    }

    // Find/create test talent
    section('Setup');
    const talent = await findOrCreateTestTalent();

    // Build context
    const context = await buildTestContext(talent.id);
    log('green', `  ✓ Context loaded:`);
    log('dim', `    Skills: ${context.profile.skills.length}`);
    log('dim', `    Documents: ${context.documents?.totalCount || 0}`);
    log('dim', `    Applications: ${context.applications?.totalCount || 0}`);
    log('dim', `    Communities: ${context.memberships?.totalCount || 0}`);
    log('dim', `    Learning topics: ${context.learning?.totalTopics || 0}`);
    log('dim', `    Graph available: ${context.graph?.isGraphAvailable}`);

    // Run tests
    const explorerResults = await runExplorerTests(context);
    const studyResults = await runStudyTests(context);

    // Print audit report
    const allResults = [...explorerResults, ...studyResults];
    printAuditReport(allResults);

    // Close connections
    await graphService.close().catch(() => {});
    await pool.end();

    const hasFailed = allResults.some(r => !r.success);
    process.exit(hasFailed ? 1 : 0);
  } catch (error: any) {
    log('red', `\n  ✗ FATAL: ${error.message}`);
    console.error(error);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main();
