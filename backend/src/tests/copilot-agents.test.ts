/**
 * Copilot Agent Calibration Tests
 * Tests all 3 agents (Explorer, Study, Org) with real prompts
 * Analyzes: verbosity, proactivity, tool usage, entity cards
 *
 * Usage: npx tsx src/tests/copilot-agents.test.ts
 */

import 'dotenv/config';
import { run } from '@openai/agents';
import type { Agent } from '@openai/agents';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../services/database';
import { createTalentAgent } from '../services/copilot/agents/talent.agent';
import { createOrgAgent } from '../services/copilot/agents/organization.agent';
import type { TalentContext, OrgContext } from '../services/copilot/types';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const AUDIT_FILE = path.resolve(__dirname, '../../../docs/copilot-calibration-audit.md');

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color: keyof typeof C, ...args: any[]) {
  console.log(C[color], ...args, C.reset);
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
// TEST SETUP
// ═══════════════════════════════════════════════════════════════

async function findTestTalent(): Promise<{ id: string; name: string }> {
  const existing = await pool.query(`
    SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
    FROM talents t
    WHERE t.deleted_at IS NULL
    ORDER BY (SELECT COUNT(*) FROM talent_skills ts WHERE ts.talent_id = t.id) DESC
    LIMIT 1
  `);

  if (existing.rows.length > 0) {
    const t = existing.rows[0];
    log('green', `  Talent: ${t.display_name} (${t.id})`);
    return { id: t.id, name: t.display_name };
  }

  throw new Error('No talent found in database.');
}

async function findTestOrg(talentId: string): Promise<{ id: string; name: string; role: string } | null> {
  const result = await pool.query(`
    SELECT o.id, o.name, om.role
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.talent_id = $1 AND o.deleted_at IS NULL
    ORDER BY om.role ASC
    LIMIT 1
  `, [talentId]);

  if (result.rows.length > 0) {
    const row = result.rows[0];
    log('green', `  Organization: ${row.name} (${row.id}) — role: ${row.role}`);
    return { id: row.id, name: row.name, role: row.role };
  }

  log('yellow', '  No organization found for this talent — skipping org tests');
  return null;
}

async function buildTestContext(talentId: string, mode: 'explore' | 'study'): Promise<TalentContext> {
  const profileRes = await pool.query(`
    SELECT t.id, t.first_name, t.last_name, t.bio, t.city, t.country, t.email, t.remote_ready
    FROM talents t WHERE t.id = $1
  `, [talentId]);

  const profile = profileRes.rows[0];
  if (!profile) throw new Error(`Talent ${talentId} not found`);

  const skillsRes = await pool.query(
    `SELECT canonical_name as name, proficiency_level as level FROM talent_skills WHERE talent_id = $1`,
    [talentId]
  );

  const langsRes = await pool.query(
    `SELECT language, proficiency_level as level FROM talent_languages WHERE talent_id = $1`,
    [talentId]
  ).catch(() => ({ rows: [] }));

  const docsRes = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE document_type IN ('cv', 'resume', 'CV')) as cv_count,
           COUNT(*) FILTER (WHERE document_type IN ('diploma', 'degree', 'DIPLOMA')) as diploma_count
    FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL
  `, [talentId]).catch(() => ({ rows: [{ total: 0, cv_count: 0, diploma_count: 0 }] }));

  const appsRes = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status NOT IN ('REJECTED')) as active
    FROM opportunity_applications WHERE talent_id = $1
  `, [talentId]).catch(() => ({ rows: [{ total: 0, active: 0 }] }));

  const membRes = await pool.query(
    `SELECT COUNT(*) as total FROM community_members WHERE talent_id = $1 AND status = 'ACTIVE'`,
    [talentId]
  ).catch(() => ({ rows: [{ total: 0 }] }));

  const docs = docsRes.rows[0];
  const apps = appsRes.rows[0];
  const memb = membRes.rows[0];

  return {
    talentId,
    talentName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    profile: {
      id: talentId,
      email: profile.email || '',
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      city: profile.city,
      country: profile.country,
      remoteReady: profile.remote_ready || false,
      skills: skillsRes.rows.map((s: any) => ({ name: s.name, level: s.level })),
      languages: langsRes.rows.map((l: any) => ({ language: l.language, level: l.level })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    documents: {
      totalCount: parseInt(docs.total) || 0,
      documents: [],
      hasCV: parseInt(docs.cv_count) > 0,
      hasDiplomas: parseInt(docs.diploma_count) > 0,
      hasCertificates: false,
    },
    applications: {
      totalCount: parseInt(apps.total) || 0,
      activeCount: parseInt(apps.active) || 0,
      applications: [],
      byStatus: {},
    },
    memberships: {
      totalCount: parseInt(memb.total) || 0,
      memberships: [],
      adminOf: [],
    },
    session: {
      currentMode: mode,
      conversationTopic: mode === 'study' ? 'General learning' : undefined,
    },
    contextLoadedAt: new Date().toISOString(),
    contextVersion: '1.0',
  };
}

function buildOrgTestContext(talentId: string, talentName: string, org: { id: string; name: string; role: string }): OrgContext {
  return {
    talentId,
    talentName,
    organizationId: org.id,
    organizationName: org.name,
    role: org.role,
  };
}

// ═══════════════════════════════════════════════════════════════
// AGENT RUNNER — FULL CAPTURE
// ═══════════════════════════════════════════════════════════════

interface ToolCallCapture {
  name: string;
  args: any;
  output: any;
  error?: string;
  durationMs?: number;
}

interface CalibrationMetrics {
  charCount: number;
  sentenceCount: number;
  asksQuestion: boolean;
  questionCount: number;
  entityCardCount: number;
  entityCardsWithScore: number;
  usedToolsImmediately: boolean;
  toolCallCount: number;
  verbosityRating: 'concise' | 'ok' | 'verbose' | 'very_verbose';
  proactivityRating: 'proactive' | 'ok' | 'passive';
}

interface TestResult {
  testName: string;
  agentType: 'explorer' | 'study' | 'org';
  targetTool: string;
  message: string;
  success: boolean;
  output: string;
  toolCalls: ToolCallCapture[];
  duration: number;
  errors: string[];
  calibration: CalibrationMetrics;
}

function analyzeCalibration(output: string, toolCalls: ToolCallCapture[]): CalibrationMetrics {
  const charCount = output.length;

  // Count sentences (split on period/exclamation/question mark followed by space or end)
  const sentences = output.split(/[.!?]+\s/).filter(s => s.trim().length > 5);
  const sentenceCount = sentences.length;

  // Check if agent asks unnecessary questions — exclude ? inside code blocks
  const textOnly = output.replace(/`{2,}[\s\S]*?`{2,}/g, ''); // strip fenced blocks
  const questionMatches = textOnly.match(/\?/g) || [];
  const questionCount = questionMatches.length;
  const asksQuestion = questionCount > 0;

  // Entity cards
  const entityCardRegex = /`{2,}entity:\w+/g;
  const entityCards = output.match(entityCardRegex) || [];
  const entityCardCount = entityCards.length;

  // Check matchScore in entity cards
  const matchScoreRegex = /matchScore/g;
  const entityCardsWithScore = (output.match(matchScoreRegex) || []).length;

  // Tool usage
  const toolCallCount = toolCalls.length;
  const usedToolsImmediately = toolCallCount > 0;

  // Verbosity rating
  let verbosityRating: CalibrationMetrics['verbosityRating'] = 'ok';
  if (charCount < 300) verbosityRating = 'concise';
  else if (charCount > 1500) verbosityRating = 'verbose';
  if (charCount > 2500) verbosityRating = 'very_verbose';

  // Proactivity rating
  let proactivityRating: CalibrationMetrics['proactivityRating'] = 'ok';
  if (usedToolsImmediately && questionCount <= 1) proactivityRating = 'proactive';
  if (!usedToolsImmediately || questionCount > 2) proactivityRating = 'passive';

  return {
    charCount,
    sentenceCount,
    asksQuestion,
    questionCount,
    entityCardCount,
    entityCardsWithScore,
    usedToolsImmediately,
    toolCallCount,
    verbosityRating,
    proactivityRating,
  };
}

async function runAgentTest(
  agent: Agent,
  testName: string,
  agentType: 'explorer' | 'study' | 'org',
  targetTool: string,
  message: string
): Promise<TestResult> {
  const start = Date.now();
  const toolCalls: ToolCallCapture[] = [];
  const errors: string[] = [];
  let output = '';
  let currentToolStart = 0;

  section(`TEST: ${testName}`);
  log('dim', `Agent: ${agentType} | Message: "${message}"`);

  try {
    const result = await run(agent, message, { stream: true });

    for await (const event of result as AsyncIterable<any>) {
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as any;
        if (data?.type === 'output_text_delta') {
          output += data.delta as string;
        }
      }

      if (event.type === 'run_item_stream_event') {
        const item = event.item as any;

        if (event.name === 'tool_called') {
          currentToolStart = Date.now();
          const toolName = item?.rawItem?.name || item?.name || 'unknown';
          let toolArgs: any;
          try {
            const rawArgs = item?.rawItem?.arguments || item?.arguments;
            toolArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
          } catch {
            toolArgs = item?.rawItem?.arguments || item?.arguments;
          }
          log('blue', `  Tool: ${toolName}`);
          log('dim', `     Args: ${JSON.stringify(toolArgs, null, 2)}`);
          toolCalls.push({ name: toolName, args: toolArgs, output: null });
        }

        if (event.name === 'tool_output') {
          const toolName = item?.rawItem?.name || item?.name || 'unknown';
          const rawOutput = item?.output;
          const toolDuration = Date.now() - currentToolStart;

          let parsedOutput: any;
          try {
            parsedOutput = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          } catch {
            parsedOutput = rawOutput;
          }

          const lastCall = [...toolCalls].reverse().find(tc => tc.name === toolName && !tc.output);
          if (lastCall) {
            lastCall.output = parsedOutput;
            lastCall.durationMs = toolDuration;
          }

          if (parsedOutput?.error) {
            errors.push(`${toolName}: ${parsedOutput.error}`);
            log('red', `  ERROR: ${toolName}: ${parsedOutput.error}`);
          } else {
            log('green', `  OK: ${toolName} (${toolDuration}ms)`);
          }
        }
      }
    }

    await (result as any).completed;
    if (!output && (result as any).finalOutput) {
      output = typeof (result as any).finalOutput === 'string'
        ? (result as any).finalOutput
        : JSON.stringify((result as any).finalOutput);
    }
  } catch (error: any) {
    errors.push(`Agent error: ${error.message}`);
    log('red', `  AGENT ERROR: ${error.message}`);
  }

  const duration = Date.now() - start;
  const calibration = analyzeCalibration(output, toolCalls);

  // Print output
  log('yellow', `\n  Output (${calibration.charCount} chars, ${duration}ms):`);
  console.log(output);

  // Calibration summary
  const vColor = calibration.verbosityRating === 'concise' || calibration.verbosityRating === 'ok' ? 'green' : 'yellow';
  const pColor = calibration.proactivityRating === 'proactive' ? 'green' : calibration.proactivityRating === 'ok' ? 'yellow' : 'red';

  log(vColor, `  Verbosity: ${calibration.verbosityRating} (${calibration.charCount} chars, ${calibration.sentenceCount} sentences)`);
  log(pColor, `  Proactivity: ${calibration.proactivityRating} (${calibration.toolCallCount} tools, ${calibration.questionCount} questions)`);
  if (calibration.entityCardCount > 0) {
    log('green', `  Entity cards: ${calibration.entityCardCount} (${calibration.entityCardsWithScore} with matchScore)`);
  }

  const success = errors.length === 0 && output.length > 20;
  if (success) {
    log('green', `\n  PASS (${duration}ms)`);
  } else {
    log('red', `\n  FAIL`);
    errors.forEach(e => log('red', `     - ${e}`));
  }

  return { testName, agentType, targetTool, message, success, output, toolCalls, duration, errors, calibration };
}

// ═══════════════════════════════════════════════════════════════
// TEST DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface TestDef {
  name: string;
  agentType: 'explorer' | 'study' | 'org';
  targetTool: string;
  message: string;
}

const TESTS: TestDef[] = [
  // ─── TALENT EXPLORER TESTS ─────────────────────
  {
    name: 'Explorer — Opportunites pertinentes',
    agentType: 'explorer',
    targetTool: 'vector_query',
    message: 'Liste moi les opportunités pertinentes pour moi',
  },
  {
    name: 'Explorer — Espaces coworking Abidjan',
    agentType: 'explorer',
    targetTool: 'vector_query',
    message: 'Dans quel espace de coworking je peux travailler a Abidjan ?',
  },
  {
    name: 'Explorer — Communautes tech Abidjan',
    agentType: 'explorer',
    targetTool: 'vector_query',
    message: "Je veux m'impregner de l'écosysteme tech a Abidjan, peux-tu me recommander des communauté ?",
  },
  {
    name: 'Explorer — Generer CV',
    agentType: 'explorer',
    targetTool: 'generate_document',
    message: 'Genere moi un nouveau CV',
  },
  {
    name: 'Explorer — Actualites communautes',
    agentType: 'explorer',
    targetTool: 'sql_query',
    message: 'Quelles sont les actualités récentes de mes communautés ?',
  },
  // ─── TALENT STUDY TESTS ────────────────────────
  {
    name: 'Study — Formation Marketing Digital',
    agentType: 'study',
    targetTool: 'vector_query',
    message: 'Je veux me former en Marketing Digital',
  },
  {
    name: 'Study — Evaluer lacunes finance',
    agentType: 'study',
    targetTool: 'sql_query',
    message: "Aide-moi a évaluer mes lacunes sur la finance",
  },
  {
    name: 'Study — C est quoi l IA',
    agentType: 'study',
    targetTool: 'vector_query',
    message: "C'est quoi l'IA ?",
  },
  {
    name: 'Study — Schema biologie cellulaire',
    agentType: 'study',
    targetTool: 'generate_diagram',
    message: 'Genere moi un schema sur la biologie cellulaire',
  },
  {
    name: 'Study — Video YouTube agriculture',
    agentType: 'study',
    targetTool: 'youtube_search',
    message: 'Donne moi un auto video YouTube sur l\'agriculture',
  },
  // ─── ORGANIZATION EXPLORER TESTS ───────────────
  {
    name: 'Org — Talents disponibles Abidjan',
    agentType: 'org',
    targetTool: 'vector_query',
    message: 'Je cherche des talents disponibles a Abidjan pour mon offre de Marketing Digital',
  },
  {
    name: 'Org — Stats organisation',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Donne moi un aperçu global de mon organisation',
  },
  {
    name: 'Org — Generer fiche de poste',
    agentType: 'org',
    targetTool: 'generate_document',
    message: "Genere moi une fiche de poste pour un développeur fullstack junior",
  },
];

// ═══════════════════════════════════════════════════════════════
// CALIBRATION REPORT
// ═══════════════════════════════════════════════════════════════

function writeCalibrationReport(results: TestResult[]) {
  let md = `# Copilot Calibration Report\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n`;
  md += `> Tests: ${results.length} | Passed: ${results.filter(r => r.success).length} | Failed: ${results.filter(r => !r.success).length}\n\n`;

  // ── CALIBRATION SUMMARY TABLE ──
  md += `## Calibration Summary\n\n`;
  md += `| Test | Agent | Chars | Questions | Tools | Verbosity | Proactivity | Cards |\n`;
  md += `|------|-------|-------|-----------|-------|-----------|-------------|-------|\n`;

  for (const r of results) {
    const c = r.calibration;
    const status = r.success ? '✅' : '❌';
    md += `| ${status} ${r.testName} | ${r.agentType} | ${c.charCount} | ${c.questionCount} | ${c.toolCallCount} | ${c.verbosityRating} | ${c.proactivityRating} | ${c.entityCardCount} (${c.entityCardsWithScore} scored) |\n`;
  }

  // ── CALIBRATION ISSUES ──
  md += `\n## Calibration Issues\n\n`;

  const verbose = results.filter(r => r.calibration.verbosityRating === 'verbose' || r.calibration.verbosityRating === 'very_verbose');
  if (verbose.length > 0) {
    md += `### Too Verbose (>${1500} chars)\n`;
    for (const r of verbose) {
      md += `- **${r.testName}**: ${r.calibration.charCount} chars, ${r.calibration.sentenceCount} sentences\n`;
    }
    md += '\n';
  }

  const passive = results.filter(r => r.calibration.proactivityRating === 'passive');
  if (passive.length > 0) {
    md += `### Not Proactive Enough\n`;
    for (const r of passive) {
      md += `- **${r.testName}**: ${r.calibration.toolCallCount} tool calls, ${r.calibration.questionCount} questions asked\n`;
    }
    md += '\n';
  }

  const noScore = results.filter(r => r.calibration.entityCardCount > 0 && r.calibration.entityCardsWithScore < r.calibration.entityCardCount);
  if (noScore.length > 0) {
    md += `### Entity Cards Missing matchScore\n`;
    for (const r of noScore) {
      md += `- **${r.testName}**: ${r.calibration.entityCardCount} cards, only ${r.calibration.entityCardsWithScore} have matchScore\n`;
    }
    md += '\n';
  }

  // ── DETAILED RESULTS ──
  md += `---\n\n## Detailed Results\n\n`;

  const agentGroups = ['explorer', 'study', 'org'] as const;
  for (const agentType of agentGroups) {
    const agentResults = results.filter(r => r.agentType === agentType);
    if (agentResults.length === 0) continue;

    md += `### ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent\n\n`;

    for (const r of agentResults) {
      const status = r.success ? '✅' : '❌';
      md += `#### ${status} ${r.testName} (${r.duration}ms)\n\n`;
      md += `**Prompt:** \`${r.message}\`\n\n`;

      // Calibration
      md += `**Calibration:** Verbosity=${r.calibration.verbosityRating}, Proactivity=${r.calibration.proactivityRating}, `;
      md += `Chars=${r.calibration.charCount}, Questions=${r.calibration.questionCount}, Tools=${r.calibration.toolCallCount}\n\n`;

      // Tool calls
      for (const tc of r.toolCalls) {
        md += `**Tool: \`${tc.name}\`** (${tc.durationMs || '?'}ms)\n`;
        md += `\`\`\`json\n${JSON.stringify(tc.args, null, 2)}\n\`\`\`\n\n`;
      }

      // Agent output
      md += `**Agent Output:**\n`;
      md += `\`\`\`markdown\n${r.output}\n\`\`\`\n\n`;

      if (r.errors.length > 0) {
        md += `**Errors:**\n`;
        for (const e of r.errors) {
          md += `- ${e}\n`;
        }
        md += '\n';
      }

      md += `---\n\n`;
    }
  }

  // ── RECOMMENDATIONS ──
  md += `## Prompt Tuning Recommendations\n\n`;

  const avgChars = results.reduce((sum, r) => sum + r.calibration.charCount, 0) / results.length;
  const avgQuestions = results.reduce((sum, r) => sum + r.calibration.questionCount, 0) / results.length;
  const avgTools = results.reduce((sum, r) => sum + r.calibration.toolCallCount, 0) / results.length;

  md += `- **Average response length:** ${Math.round(avgChars)} chars (target: 300-800)\n`;
  md += `- **Average questions per response:** ${avgQuestions.toFixed(1)} (target: 0-1)\n`;
  md += `- **Average tool calls per response:** ${avgTools.toFixed(1)} (target: 1-3)\n\n`;

  if (avgChars > 1200) {
    md += `> **ACTION: Reduce verbosity.** Add explicit length constraint to prompts: "Keep responses between 3-5 sentences plus entity cards."\n\n`;
  }
  if (avgQuestions > 1.5) {
    md += `> **ACTION: Reduce questions.** Agent asks too many questions instead of executing. Add: "Do NOT ask clarifying questions — use tools immediately based on available context."\n\n`;
  }
  if (avgTools < 1) {
    md += `> **ACTION: Increase tool usage.** Agent not using tools enough. Reinforce: "ALWAYS use at least one tool before responding."\n\n`;
  }

  fs.writeFileSync(AUDIT_FILE, md, 'utf-8');
  log('green', `\n  Report written: ${AUDIT_FILE}`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  header('COPILOT AGENT CALIBRATION');
  log('dim', `  Date: ${new Date().toISOString()}`);
  log('dim', `  OpenAI Key: ${process.env.OPENAI_API_KEY ? 'set' : 'MISSING'}`);
  log('dim', `  Pinecone Key: ${process.env.PINECONE_API_KEY ? 'set' : 'MISSING'}`);
  log('dim', `  YouTube Key: ${process.env.YOUTUBE_API_KEY ? 'set' : 'MISSING'}`);

  if (!process.env.OPENAI_API_KEY) {
    log('red', '  OPENAI_API_KEY not set.');
    process.exit(1);
  }

  try {
    section('Setup');
    const talent = await findTestTalent();
    const org = await findTestOrg(talent.id);
    const allResults: TestResult[] = [];

    // Group tests by agent type
    const explorerTests = TESTS.filter(t => t.agentType === 'explorer');
    const studyTests = TESTS.filter(t => t.agentType === 'study');
    const orgTests = TESTS.filter(t => t.agentType === 'org');

    // ─── EXPLORER TESTS ────────────────────────────
    if (explorerTests.length > 0) {
      header('TALENT EXPLORER AGENT');
      const explorerCtx = await buildTestContext(talent.id, 'explore');
      const explorerAgent = createTalentAgent(explorerCtx);
      log('dim', `  Skills: ${explorerCtx.profile.skills?.length || 0}`);

      for (const test of explorerTests) {
        try {
          const result = await runAgentTest(explorerAgent, test.name, test.agentType, test.targetTool, test.message);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive' },
          });
        }
      }
    }

    // ─── STUDY TESTS ─────────────────────────────
    if (studyTests.length > 0) {
      header('TALENT STUDY AGENT');
      const studyCtx = await buildTestContext(talent.id, 'study');
      const studyAgent = createTalentAgent(studyCtx);

      for (const test of studyTests) {
        try {
          const result = await runAgentTest(studyAgent, test.name, test.agentType, test.targetTool, test.message);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive' },
          });
        }
      }
    }

    // ─── ORG TESTS ───────────────────────────────
    if (orgTests.length > 0 && org) {
      header('ORGANIZATION AGENT');
      const orgCtx = buildOrgTestContext(talent.id, talent.name, org);
      const orgAgent = createOrgAgent(orgCtx);

      for (const test of orgTests) {
        try {
          const result = await runAgentTest(orgAgent, test.name, test.agentType, test.targetTool, test.message);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive' },
          });
        }
      }
    } else if (orgTests.length > 0 && !org) {
      log('yellow', '  Skipping org tests — no organization found');
    }

    // ─── SUMMARY ─────────────────────────────────
    header('CALIBRATION SUMMARY');

    const passed = allResults.filter(r => r.success).length;
    const failed = allResults.length - passed;
    log('bold', `  Total: ${allResults.length} | Passed: ${passed} | Failed: ${failed}`);

    // Calibration overview
    section('Calibration Metrics');
    const avgChars = allResults.reduce((sum, r) => sum + r.calibration.charCount, 0) / allResults.length;
    const avgQuestions = allResults.reduce((sum, r) => sum + r.calibration.questionCount, 0) / allResults.length;
    const avgTools = allResults.reduce((sum, r) => sum + r.calibration.toolCallCount, 0) / allResults.length;

    log('bold', `  Avg response length: ${Math.round(avgChars)} chars`);
    log('bold', `  Avg questions/response: ${avgQuestions.toFixed(1)}`);
    log('bold', `  Avg tool calls/response: ${avgTools.toFixed(1)}`);

    const verboseCount = allResults.filter(r => r.calibration.verbosityRating === 'verbose' || r.calibration.verbosityRating === 'very_verbose').length;
    const passiveCount = allResults.filter(r => r.calibration.proactivityRating === 'passive').length;

    if (verboseCount > 0) log('yellow', `  ${verboseCount}/${allResults.length} responses too verbose`);
    if (passiveCount > 0) log('red', `  ${passiveCount}/${allResults.length} responses not proactive enough`);

    // Per-test summary
    section('Per-Test Results');
    for (const r of allResults) {
      const status = r.success ? 'PASS' : 'FAIL';
      const statusColor = r.success ? 'green' : 'red';
      const vFlag = (r.calibration.verbosityRating === 'verbose' || r.calibration.verbosityRating === 'very_verbose') ? ' [VERBOSE]' : '';
      const pFlag = r.calibration.proactivityRating === 'passive' ? ' [PASSIVE]' : '';
      log(statusColor, `  ${status} ${r.testName} — ${r.calibration.charCount}ch, ${r.calibration.toolCallCount}t, ${r.calibration.questionCount}q${vFlag}${pFlag}`);
    }

    // Tool usage
    section('Tool Usage');
    const toolStats = new Map<string, { calls: number; errors: number }>();
    for (const r of allResults) {
      for (const tc of r.toolCalls) {
        const s = toolStats.get(tc.name) || { calls: 0, errors: 0 };
        s.calls++;
        if (tc.error) s.errors++;
        toolStats.set(tc.name, s);
      }
    }
    for (const [name, s] of toolStats) {
      log(s.errors > 0 ? 'yellow' : 'green', `  ${name}: ${s.calls} calls, ${s.errors} errors`);
    }

    // Write report
    writeCalibrationReport(allResults);

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    log('red', `  FATAL: ${error.message}`);
    console.error(error);
    await pool.end().catch(() => { });
    process.exit(1);
  }
}

main();
