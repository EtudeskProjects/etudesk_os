/**
 * Copilot Agent Calibration Tests
 * Tests all 3 agents (Explorer, Study, Org) with real prompts
 * Analyzes: verbosity, proactivity, tool usage, entity cards
 *
 * Usage: npx tsx src/tests/copilot-agents.test.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../services/database';
import { createTalentAgent } from '../services/copilot/agents/talent.agent';
import { createOrgAgent } from '../services/copilot/agents/organization.agent';
import { detectSkillFromMessageStatic } from '../services/copilot/skills/skill.loader';
import type { AgentConfig } from '../services/copilot/tools/tool-helper';
import type { TalentContext, OrgContext } from '../services/copilot/types';
import { MODEL_AGENT } from '../services/ai/models';
import { getChatClient } from '../services/ai/provider';
import {
  AGENTIC_LIMITS,
  buildAgentSystemText,
  buildChatCompletionTools,
  buildMissingRequiredToolMessage,
  buildToolPreface,
  enforceToolCallLimit,
  getAgentCompletionOptions,
  inferInitialToolChoice,
  inferRequiredCompletionTool,
} from '../services/copilot/agentic-policy';

// --- Config ---

const AUDIT_FILE = path.resolve(__dirname, '../../../docs/copilot-calibration-audit.md');

// CLI args: pass test names as arguments to run only specific tests
// Usage: npx tsx src/tests/copilot-agents.test.ts "Espaces coworking" "Generer CV"
const FILTER_ARGS = process.argv.slice(2).map(a => a.toLowerCase());
const AUDIT_15 = process.env.COPILOT_AUDIT_15 === '1';
const AUDIT_10 = process.env.COPILOT_AUDIT_10 === '1';
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

// --- Test Setup ---

async function findTestTalent(): Promise<{ id: string; name: string }> {
  const existing = await pool.query(`
    SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
    FROM talents t
    WHERE t.deleted_at IS NULL
    ORDER BY (t.slug = COALESCE($1, 'app-review')) DESC,
             (SELECT COUNT(*) FROM talent_skills ts WHERE ts.talent_id = t.id) DESC
    LIMIT 1
  `, [process.env.COPILOT_AUDIT_TALENT_SLUG || 'app-review']);

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
    `SELECT c.name AS name, ts.level AS level
     FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
     WHERE ts.talent_id = $1`,
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
    language: 'fr',
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
    language: 'fr',
  };
}

function activeSkillFor(message: string, mode: 'explore' | 'study' | 'org'): { name: string; instructions: string } | null {
  const detectedSkill = detectSkillFromMessageStatic(message, mode);
  if (!detectedSkill) return null;
  return {
    name: detectedSkill.skillName,
    instructions: `\n<active_skill_instructions skill="${detectedSkill.skillId}" name="${detectedSkill.skillName}">\n${detectedSkill.instructions}\n</active_skill_instructions>\n`,
  };
}

// --- Agent Execution — Full Capture ---

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
  hasQuickAck: boolean; // Agent output text BEFORE first tool call
  quickAckText: string; // The text before first tool call
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
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    requests: number;
  };
}

function analyzeCalibration(output: string, toolCalls: ToolCallCapture[], textBeforeFirstTool: string = ''): CalibrationMetrics {
  const textOnly = output.replace(/`{2,}[\s\S]*?`{2,}/g, ''); // strip fenced structural blocks
  const charCount = textOnly.length;

  // Count sentences (split on period/exclamation/question mark followed by space or end)
  const sentences = textOnly.split(/[.!?]+\s/).filter(s => s.trim().length > 5);
  const sentenceCount = sentences.length;

  // Check if agent asks unnecessary questions — exclude ? inside code blocks
  const questionMatches = textOnly.match(/\?/g) || [];
  const questionCount = questionMatches.length;
  const asksQuestion = questionCount > 0;

  // Entity cards
  const entityCardRegex = /`{2,}entity:\w+/g;
  const entityCards = output.match(entityCardRegex) || [];
  const entityCardCount = entityCards.length;

  // Check for FORBIDDEN extra data in entity cards (matchScore, title, name, etc.)
  // Per perimeter: entity cards must contain ONLY {"id":"uuid"} — matchScore is a VIOLATION, not a feature
  const matchScoreRegex = /matchScore/g;
  const entityCardsWithScore = (output.match(matchScoreRegex) || []).length;

  // Tool usage
  const toolCallCount = toolCalls.length;
  const usedToolsImmediately = toolCallCount > 0;
  const hasConfirmationAction = /`{3}confirmation\s*\n/i.test(output);

  // Verbosity rating
  let verbosityRating: CalibrationMetrics['verbosityRating'] = 'ok';
  if (charCount < 300) verbosityRating = 'concise';
  else if (charCount > 1500) verbosityRating = 'verbose';
  if (charCount > 2500) verbosityRating = 'very_verbose';

  // Proactivity rating
  let proactivityRating: CalibrationMetrics['proactivityRating'] = 'ok';
  if ((usedToolsImmediately || hasConfirmationAction) && questionCount <= 1) proactivityRating = 'proactive';
  if ((!usedToolsImmediately && !hasConfirmationAction) || questionCount > 2) proactivityRating = 'passive';

  // Quick ack: agent output text before first tool call (for streaming responsiveness)
  const ackTrimmed = textBeforeFirstTool.trim();
  const hasQuickAck = toolCallCount > 0 && ackTrimmed.length > 3;

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
    hasQuickAck,
    quickAckText: ackTrimmed.slice(0, 80),
  };
}

const ENTITY_CARD_ID_REGEX = /```entity:(?!maps)(\w+)\s*\n\s*\{\s*"id"\s*:\s*"([^"]+)"/g;
const UUID_VALUE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectToolResultIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  const serialized = JSON.stringify(value) || '';
  for (const match of serialized.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)) {
    if (UUID_VALUE_REGEX.test(match[0])) ids.add(match[0]);
  }
  return ids;
}

async function validateEntityCardsComeFromTools(output: string, toolCalls: ToolCallCapture[]): Promise<string[]> {
  const allowedIds = collectToolResultIds(toolCalls.map((tc) => tc.output));
  const errors: string[] = [];
  for (const match of output.matchAll(ENTITY_CARD_ID_REGEX)) {
    const entityType = match[1];
    const id = match[2];
    if (!UUID_VALUE_REGEX.test(id)) {
      errors.push(`Entity card id ${id} is not a valid UUID`);
      continue;
    }
    if (toolCalls.length === 0) {
      errors.push(`Entity card id ${id} was produced without any tool call`);
      continue;
    }
    if (!allowedIds.has(id) && !(await entityExists(entityType, id))) {
      errors.push(`Entity card id ${id} was not present in any tool result`);
    }
  }
  return errors;
}

async function entityExists(entityType: string, id: string): Promise<boolean> {
  if (entityType === 'document') {
    const res = await pool.query(
      `SELECT 1 FROM talent_documents WHERE id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM organization_documents WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return (res.rowCount || 0) > 0;
  }

  const tableByType: Record<string, string> = {
    opportunity: 'opportunities',
    community: 'communities',
    space: 'spaces',
    organization: 'organizations',
    talent: 'talents',
    event: 'community_activities',
    notification: 'notifications',
  };
  const table = tableByType[entityType];
  if (!table) return false;
  const res = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return (res.rowCount || 0) > 0;
}

async function runAgentTest(
  agent: AgentConfig,
  testName: string,
  agentType: 'explorer' | 'study' | 'org',
  targetTool: string,
  message: string,
  forbiddenBlocks: string[] = []
): Promise<TestResult> {
  const start = Date.now();
  const toolCalls: ToolCallCapture[] = [];
  const errors: string[] = [];
  let output = '';
  let currentToolStart = 0;
  let textBeforeFirstTool = '';
  let firstToolSeen = false;
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    requests: 0,
  };
  const perToolCounts = new Map<string, number>();
  const sqlIntentCounts = new Map<string, number>();

  section(`TEST: ${testName}`);
  log('dim', `Agent: ${agentType} | Message: "${message}"`);

  try {
    const client = getChatClient();
    const messages: any[] = [{ role: 'user' as const, content: message }];
    const toolDefs = buildChatCompletionTools(agent.tools);
    const completionOptions = getAgentCompletionOptions();
    const systemText = buildAgentSystemText(agent);
    const initialToolChoice = inferInitialToolChoice(agent.mode, message);
    const requiredCompletionTool = inferRequiredCompletionTool(agent.mode, message);
    let requiredToolRetryUsed = false;
    if (
      initialToolChoice &&
      typeof initialToolChoice === 'object' &&
      initialToolChoice.type === 'function'
    ) {
      const preface = buildToolPreface(initialToolChoice.function.name);
      output += preface;
      textBeforeFirstTool += preface;
    }
    let turnCount = 0;

    while (turnCount < AGENTIC_LIMITS.maxTurns) {
      const response = await client.chat.completions.create({
        model: agent.model,
        messages: [{ role: 'system' as const, content: systemText }, ...messages],
        tools: toolDefs,
        tool_choice: turnCount === 0 ? initialToolChoice || 'auto' : 'auto',
        ...completionOptions,
      });
      usage.requests++;
      usage.inputTokens += response.usage?.prompt_tokens || 0;
      usage.outputTokens += response.usage?.completion_tokens || 0;
      usage.cachedTokens += (response.usage as any)?.prompt_tokens_details?.cached_tokens || 0;

      const responseMessage = response.choices[0]?.message;
      const responseText = responseMessage?.content || '';
      output += responseText;
      if (!firstToolSeen) textBeforeFirstTool += responseText;

      // Check for tool_use blocks
      const toolUseBlocks = responseMessage?.tool_calls || [];

      if (
        toolUseBlocks.length === 0 &&
        requiredCompletionTool &&
        !requiredToolRetryUsed &&
        !toolCalls.some((tc) => tc.name === requiredCompletionTool)
      ) {
        requiredToolRetryUsed = true;
        messages.push(responseMessage);
        messages.push({ role: 'user' as const, content: buildMissingRequiredToolMessage(requiredCompletionTool) });
        continue;
      }

      if (toolUseBlocks.length === 0) break; // No tools → done

      // Execute tools
      messages.push(responseMessage);
      const toolResults: any[] = [];

      for (const toolUse of toolUseBlocks) {
        if (!firstToolSeen) firstToolSeen = true;
        currentToolStart = Date.now();
        const toolName = (toolUse as any).function?.name;
        let toolArgs: any = {};
        try {
          toolArgs = JSON.parse((toolUse as any).function?.arguments || '{}');
        } catch (parseError: any) {
          const rawArgs = String((toolUse as any).function?.arguments || '');
          errors.push(`${toolName}: invalid JSON tool arguments (${parseError.message})`);
          log('red', `  ERROR: ${toolName}: invalid JSON tool arguments`);
          toolCalls.push({
            name: toolName,
            args: { _invalidJson: true, rawPreview: rawArgs.slice(0, 300) },
            output: { error: 'Invalid JSON tool arguments' },
            error: parseError.message,
          });
          messages.push({
            role: 'tool',
            tool_call_id: (toolUse as any).id,
            content: JSON.stringify({ error: 'Invalid JSON tool arguments. Retry with valid compact JSON only.' }),
          });
          continue;
        }
        const toolNameCount = (perToolCounts.get(toolName) || 0) + 1;
        perToolCounts.set(toolName, toolNameCount);

        log('blue', `  Tool: ${toolName}`);
        log('dim', `     Args: ${JSON.stringify(toolArgs, null, 2)}`);
        toolCalls.push({ name: toolName, args: toolArgs, output: null });

        const toolDef = agent.tools.find(t => t.definition.name === toolName);
        let result: any;
        try {
          const limit = enforceToolCallLimit({
            toolName,
            toolInput: toolArgs,
            toolNameCount,
            sqlIntentCounts,
          });
          if (limit.limited) {
            result = limit.output;
          } else {
            result = toolDef ? await toolDef.execute(toolArgs) : { error: `Unknown tool: ${toolName}` };
          }
        } catch (err: any) {
          result = { error: err.message };
        }

        const toolDuration = Date.now() - currentToolStart;
        const lastCall = [...toolCalls].reverse().find(tc => tc.name === toolName && !tc.output);
        if (lastCall) {
          lastCall.output = result;
          lastCall.durationMs = toolDuration;
        }

        if (result?.error) {
          errors.push(`${toolName}: ${result.error}`);
          log('red', `  ERROR: ${toolName}: ${result.error}`);
        } else {
          log('green', `  OK: ${toolName} (${toolDuration}ms)`);
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: (toolUse as any).id,
          content: JSON.stringify(result),
        });
      }

      messages.push(...toolResults);
      turnCount++;
    }
  } catch (error: any) {
    const errorDetail = error.code ? `${error.message} (code: ${error.code})` : error.message;
    errors.push(`Agent error: ${errorDetail}`);
    log('red', `  AGENT ERROR: ${errorDetail}`);
    if (error.stack) {
      const relevantStack = error.stack.split('\n').slice(0, 4).join('\n');
      log('dim', `  ${relevantStack}`);
    }
  }

  const duration = Date.now() - start;
  const calibration = analyzeCalibration(output, toolCalls, textBeforeFirstTool);
  if (targetTool !== 'none' && !toolCalls.some((tc) => tc.name === targetTool)) {
    errors.push(`Expected tool "${targetTool}" was not called`);
  }
  for (const block of forbiddenBlocks) {
    const blockRegex = new RegExp('```' + block + '\\b', 'i');
    if (blockRegex.test(output)) {
      errors.push(`Forbidden block "${block}" was rendered`);
    }
  }
  errors.push(...await validateEntityCardsComeFromTools(output, toolCalls));

  // Print output
  log('yellow', `\n  Output (${calibration.charCount} chars, ${duration}ms, tokens in/out/cached: ${usage.inputTokens}/${usage.outputTokens}/${usage.cachedTokens}):`);
  console.log(output);

  // Calibration summary
  const vColor = calibration.verbosityRating === 'concise' || calibration.verbosityRating === 'ok' ? 'green' : 'yellow';
  const pColor = calibration.proactivityRating === 'proactive' ? 'green' : calibration.proactivityRating === 'ok' ? 'yellow' : 'red';

  log(vColor, `  Verbosity: ${calibration.verbosityRating} (${calibration.charCount} chars, ${calibration.sentenceCount} sentences)`);
  log(pColor, `  Proactivity: ${calibration.proactivityRating} (${calibration.toolCallCount} tools, ${calibration.questionCount} questions)`);
  if (calibration.toolCallCount > 0) {
    const ackColor = calibration.hasQuickAck ? 'green' : 'red';
    log(ackColor, `  Quick Ack: ${calibration.hasQuickAck ? 'YES' : 'NO'}${calibration.quickAckText ? ` — "${calibration.quickAckText}"` : ''}`);
  }
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

  return { testName, agentType, targetTool, message, success, output, toolCalls, duration, errors, calibration, usage };
}

// --- Test Definitions ---

interface TestDef {
  name: string;
  agentType: 'explorer' | 'study' | 'org';
  targetTool: string;
  message: string;
  forbiddenBlocks?: string[];
}

const TESTS: TestDef[] = [
  // --- Talent Explorer Tests ---
  {
    name: 'Explorer — Opportunites matching profil',
    agentType: 'explorer',
    targetTool: 'smart_search',
    message: 'Quels postes correspondent a mon profil en ce moment ?',
  },
  {
    name: 'Explorer — Espaces coworking remote',
    agentType: 'explorer',
    targetTool: 'smart_search',
    message: 'Je cherche un espace de travail calme avec wifi',
  },
  {
    name: 'Explorer — Communautes tech',
    agentType: 'explorer',
    targetTool: 'smart_search',
    message: 'Quelles communautes tech actives existent dans mon secteur ?',
  },
  {
    name: 'Explorer — Generer CV a jour',
    agentType: 'explorer',
    targetTool: 'generate_document',
    message: 'Fais-moi un CV a jour stp',
  },
  {
    name: 'Explorer — Actualites communautes',
    agentType: 'explorer',
    targetTool: 'sql_query',
    message: 'Quoi de neuf dans mes communautes cette semaine ?',
  },
  // --- Talent Study Tests ---
  {
    name: 'Study — Debuter marketing digital',
    agentType: 'study',
    targetTool: 'none',
    message: 'Je debute en marketing digital, par ou commencer ?',
  },
  {
    name: 'Study — Diagnostic competences finance',
    agentType: 'study',
    targetTool: 'none',
    message: "Fais-moi un diagnostic de mes competences en finance d'entreprise",
  },
  {
    name: 'Study — Expliquer le machine learning',
    agentType: 'study',
    targetTool: 'none',
    message: 'Explique-moi le machine learning simplement',
  },
  {
    name: 'Study — Schema cycle de Krebs',
    agentType: 'study',
    targetTool: 'generate_diagram',
    message: 'Dessine-moi le cycle de Krebs en biologie',
  },
  {
    name: 'Study — Video YouTube agriculture durable',
    agentType: 'study',
    targetTool: 'youtube_search',
    message: 'Trouve-moi une bonne video YouTube sur l\'agriculture durable',
  },
  {
    name: 'Study — Self assessment skills audit',
    agentType: 'study',
    targetTool: 'none',
    message: 'Do a self assessment of my skills: audit my profile, strengths, weaknesses, possible jobs and opportunity directions',
    forbiddenBlocks: ['quiz'],
  },
  // --- Organization Explorer Tests ---
  {
    name: 'Org — Recruter profils marketing',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Trouve-moi 5 profils marketing digital seniors disponibles en remote',
  },
  {
    name: 'Org — Dashboard organisation',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Comment se porte mon organisation ?',
  },
  {
    name: 'Org — Generer fiche de poste',
    agentType: 'org',
    targetTool: 'generate_document',
    message: 'Redige une fiche de poste pour un developpeur fullstack junior Node.js',
  },
  {
    name: 'Org — Publier offre stage',
    agentType: 'org',
    targetTool: 'none',
    message: 'Publie une offre de stage en communication digitale remote, 3 mois',
  },
  // --- New Intent Tests (Phase Renforcement) ---
  {
    name: 'Explorer — Feed communaute',
    agentType: 'explorer',
    targetTool: 'sql_query',
    message: 'Montre-moi les dernieres activites dans mes communautes',
  },
  {
    name: 'Explorer — Membres communaute',
    agentType: 'explorer',
    targetTool: 'sql_query',
    message: 'Qui sont les membres de ma premiere communaute ?',
  },
  {
    name: 'Org — Documents organisation',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Liste-moi les documents de mon organisation',
  },
  {
    name: 'Org — Talents CRM',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Montre-moi les talents qui ont interagi avec mon organisation',
  },
  {
    name: 'Org — Profil talent candidat',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Donne-moi le profil detaille du dernier candidat qui a postule chez nous',
  },
  {
    name: 'Org — Feed communaute org',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Quelles sont les dernieres activites dans nos communautes ?',
  },
  {
    name: 'Org — Membres communaute org',
    agentType: 'org',
    targetTool: 'sql_query',
    message: 'Liste les membres de notre premiere communaute',
  },
];

// --- Calibration Report ---

function writeCalibrationReport(results: TestResult[]) {
  let md = `# Copilot Calibration Report\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n`;
  md += `> Tests: ${results.length} | Passed: ${results.filter(r => r.success).length} | Failed: ${results.filter(r => !r.success).length}\n\n`;

  // --- Calibration Summary Table ---
  md += `## Calibration Summary\n\n`;
  md += `| Test | Agent | Chars | Questions | Tools | Tokens In | Tokens Out | Cached | Verbosity | Proactivity | Quick Ack | Cards |\n`;
  md += `|------|-------|-------|-----------|-------|-----------|------------|--------|-----------|-------------|-----------|-------|\n`;

  for (const r of results) {
    const c = r.calibration;
    const status = r.success ? '✅' : '❌';
    const cardsInfo = c.entityCardsWithScore > 0 ? `${c.entityCardCount} (⚠️ ${c.entityCardsWithScore} with matchScore)` : `${c.entityCardCount}`;
    const ackInfo = c.toolCallCount > 0 ? (c.hasQuickAck ? '✅' : '❌') : 'N/A';
    md += `| ${status} ${r.testName} | ${r.agentType} | ${c.charCount} | ${c.questionCount} | ${c.toolCallCount} | ${r.usage.inputTokens} | ${r.usage.outputTokens} | ${r.usage.cachedTokens} | ${c.verbosityRating} | ${c.proactivityRating} | ${ackInfo} | ${cardsInfo} |\n`;
  }

  // --- Calibration Issues ---
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

  // Check missing quick ack (agent didn't output text before first tool call)
  const noAck = results.filter(r => r.calibration.toolCallCount > 0 && !r.calibration.hasQuickAck);
  if (noAck.length > 0) {
    md += `### ❌ Missing Quick Acknowledgment (slow time-to-first-token)\n`;
    for (const r of noAck) {
      md += `- **${r.testName}**: No text before first tool call — user sees nothing until tool completes\n`;
    }
    md += '\n';
  }

  // Check entity cards have FORBIDDEN extra data (matchScore is a violation per perimeter)
  const withScore = results.filter(r => r.calibration.entityCardsWithScore > 0);
  if (withScore.length > 0) {
    md += `### ❌ Entity Cards Contain Forbidden matchScore\n`;
    for (const r of withScore) {
      md += `- **${r.testName}**: ${r.calibration.entityCardsWithScore} cards have matchScore (VIOLATION — cards must only contain {"id":"uuid"})\n`;
    }
    md += '\n';
  }

  // --- Detailed Results ---
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
      md += `**Usage:** Requests=${r.usage.requests}, Input=${r.usage.inputTokens}, Output=${r.usage.outputTokens}, Cached=${r.usage.cachedTokens}\n\n`;

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

  // --- Recommendations ---
  md += `## Prompt Tuning Recommendations\n\n`;

  const avgChars = results.reduce((sum, r) => sum + r.calibration.charCount, 0) / results.length;
  const avgQuestions = results.reduce((sum, r) => sum + r.calibration.questionCount, 0) / results.length;
  const avgTools = results.reduce((sum, r) => sum + r.calibration.toolCallCount, 0) / results.length;
  const totalInputTokens = results.reduce((sum, r) => sum + r.usage.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.usage.outputTokens, 0);
  const totalCachedTokens = results.reduce((sum, r) => sum + r.usage.cachedTokens, 0);

  md += `- **Average response length:** ${Math.round(avgChars)} chars (target: 300-800)\n`;
  md += `- **Average questions per response:** ${avgQuestions.toFixed(1)} (target: 0-1)\n`;
  md += `- **Average tool calls per response:** ${avgTools.toFixed(1)} (target: 1-3)\n\n`;
  md += `- **Total tokens:** input=${totalInputTokens}, output=${totalOutputTokens}, cached=${totalCachedTokens}\n\n`;

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

// --- Main ---

async function main() {
  header('COPILOT AGENT CALIBRATION');
  log('dim', `  Date: ${new Date().toISOString()}`);
  log('dim', `  Agent model: ${MODEL_AGENT}`);
  log('dim', `  Completion options: ${JSON.stringify(getAgentCompletionOptions())}`);
  log('dim', `  AI provider key: ${process.env.AI_API_KEY || process.env.OPENAI_API_KEY ? 'set' : 'MISSING'}`);
  log('dim', `  YouTube Key: ${process.env.YOUTUBE_API_KEY ? 'set' : 'MISSING'}`);

  if (!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) {
    log('red', '  AI_API_KEY or OPENAI_API_KEY not set.');
    process.exit(1);
  }

  try {
    section('Setup');

    // DB pool warmup — prevent ECONNRESET on first queries
    await pool.query('SELECT 1');
    log('green', '  DB pool warmed up');

    const talent = await findTestTalent();
    const org = await findTestOrg(talent.id);
    const allResults: TestResult[] = [];

    // Filter tests if CLI args provided
    const filteredTests = FILTER_ARGS.length > 0
      ? TESTS.filter(t => FILTER_ARGS.some(f => t.name.toLowerCase().includes(f)))
      : TESTS;

    if (FILTER_ARGS.length > 0) {
      log('cyan', `  Running ${filteredTests.length}/${TESTS.length} tests (filter: ${FILTER_ARGS.join(', ')})`);
    }

    // Group tests by agent type
    const explorerTests = filteredTests.filter(t => t.agentType === 'explorer').slice(0, (AUDIT_15 || AUDIT_10) ? 5 : undefined);
    const studyTests = AUDIT_10 ? [] : filteredTests.filter(t => t.agentType === 'study').slice(0, AUDIT_15 ? 5 : undefined);
    const orgTests = filteredTests.filter(t => t.agentType === 'org').slice(0, (AUDIT_15 || AUDIT_10) ? 5 : undefined);
    if (AUDIT_15) {
      log('cyan', `  Running audit-15 mode: ${explorerTests.length} career/explorer + ${studyTests.length} study + ${orgTests.length} org`);
    }
    if (AUDIT_10) {
      log('cyan', `  Running audit-10 mode: ${explorerTests.length} career/explorer + ${orgTests.length} org`);
    }

    // --- Explorer Tests ---
    if (explorerTests.length > 0) {
      header('TALENT EXPLORER AGENT');
      const explorerCtx = await buildTestContext(talent.id, 'explore');
      log('dim', `  Skills: ${explorerCtx.profile.skills?.length || 0}`);

      for (const test of explorerTests) {
        try {
          const activeSkill = activeSkillFor(test.message, 'explore');
          if (activeSkill) log('dim', `  Active skill: ${activeSkill.name}`);
          const explorerAgent = createTalentAgent({
            ...explorerCtx,
            activeSkillInstructions: activeSkill?.instructions,
          });
          const result = await runAgentTest(explorerAgent, test.name, test.agentType, test.targetTool, test.message, test.forbiddenBlocks);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive', hasQuickAck: false, quickAckText: '' },
            usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 },
          });
        }
      }
    }

    // --- Study Tests ---
    if (studyTests.length > 0) {
      await pool.query('SELECT 1'); // keepalive between batches
      header('TALENT STUDY AGENT');
      const studyCtx = await buildTestContext(talent.id, 'study');

      for (const test of studyTests) {
        try {
          const activeSkill = activeSkillFor(test.message, 'study');
          if (activeSkill) log('dim', `  Active skill: ${activeSkill.name}`);
          const studyAgent = createTalentAgent({
            ...studyCtx,
            activeSkillInstructions: activeSkill?.instructions,
          });
          const result = await runAgentTest(studyAgent, test.name, test.agentType, test.targetTool, test.message, test.forbiddenBlocks);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive', hasQuickAck: false, quickAckText: '' },
            usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 },
          });
        }
      }
    }

    // --- Org Tests ---
    if (orgTests.length > 0 && org) {
      await pool.query('SELECT 1'); // keepalive between batches
      header('ORGANIZATION AGENT');
      const orgCtx = buildOrgTestContext(talent.id, talent.name, org);

      for (const test of orgTests) {
        try {
          const activeSkill = activeSkillFor(test.message, 'org');
          if (activeSkill) log('dim', `  Active skill: ${activeSkill.name}`);
          const orgAgent = createOrgAgent({
            ...orgCtx,
            activeSkillInstructions: activeSkill?.instructions,
          });
          const result = await runAgentTest(orgAgent, test.name, test.agentType, test.targetTool, test.message, test.forbiddenBlocks);
          allResults.push(result);
        } catch (error: any) {
          log('red', `  "${test.name}" crashed: ${error.message}`);
          allResults.push({
            testName: test.name, agentType: test.agentType, targetTool: test.targetTool,
            message: test.message, success: false, output: '', toolCalls: [],
            duration: 0, errors: [`Crash: ${error.message}`],
            calibration: { charCount: 0, sentenceCount: 0, asksQuestion: false, questionCount: 0, entityCardCount: 0, entityCardsWithScore: 0, usedToolsImmediately: false, toolCallCount: 0, verbosityRating: 'concise', proactivityRating: 'passive', hasQuickAck: false, quickAckText: '' },
            usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 },
          });
        }
      }
    } else if (orgTests.length > 0 && !org) {
      log('yellow', '  Skipping org tests — no organization found');
    }

    // --- Summary ---
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
      const aFlag = (r.calibration.toolCallCount > 0 && !r.calibration.hasQuickAck) ? ' [NO ACK]' : '';
      log(statusColor, `  ${status} ${r.testName} — ${r.calibration.charCount}ch, ${r.calibration.toolCallCount}t, ${r.calibration.questionCount}q, tokens ${r.usage.inputTokens}/${r.usage.outputTokens}/${r.usage.cachedTokens}${vFlag}${pFlag}${aFlag}`);
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
