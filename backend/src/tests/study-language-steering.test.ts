/**
 * Study Language Steering Harness
 *
 * Verifies the natural-language Study Mode workflow:
 *   - language learning starts vocal-first with audio_tts,
 *   - a voice-note practice turn keeps the correction loop alive,
 *   - no quiz/video/passive content is used as the default path,
 *   - no skill update is made from early practice.
 *
 * Usage:
 *   npx tsx src/tests/study-language-steering.test.ts
 *
 * NOTE: uses the real AI provider (token cost). It should not mutate skills.
 */

import 'dotenv/config';
import { pool } from '../services/database';
import { createTalentAgent } from '../services/copilot/agents/talent.agent';
import type { AgentConfig } from '../services/copilot/tools/tool-helper';
import type { TalentContext } from '../services/copilot/types';
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
import { getSkillBody } from '../services/copilot/skills/skill.loader';

const TALENT_ID = '90000000-0000-4000-8000-000000000001';
const LANGUAGE = 'fr' as const;
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};

interface ToolCallCapture { name: string; args: any; output: any; error?: string; durationMs?: number; }
interface AgentTurnResult { output: string; toolCalls: ToolCallCapture[]; errors: string[]; }
interface Check { check: string; pass: boolean; detail: string; }

function log(c: keyof typeof C, ...a: any[]) { console.log(C[c], ...a, C.reset); }
function header(t: string) { console.log('\n' + '═'.repeat(72)); log('bold', `  ${t}`); console.log('═'.repeat(72)); }
function section(t: string) { console.log('\n' + '─'.repeat(60)); log('cyan', `  ${t}`); console.log('─'.repeat(60)); }

async function buildLanguageContext(): Promise<TalentContext> {
  const profileRes = await pool.query(
    `SELECT t.id, t.first_name, t.last_name, t.bio, t.city, t.country, t.email, t.remote_ready
     FROM talents t WHERE t.id = $1`,
    [TALENT_ID],
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error(`Talent ${TALENT_ID} not found`);

  const skillsRes = await pool.query(
    `SELECT c.name AS name, ts.level AS level, c.type AS type
     FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
     WHERE ts.talent_id = $1`,
    [TALENT_ID],
  );
  const langsRes = await pool.query(
    `SELECT language, proficiency_level as level FROM talent_languages WHERE talent_id = $1`,
    [TALENT_ID],
  ).catch(() => ({ rows: [] }));
  const docsRes = await pool.query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE document_type IN ('cv','resume','CV')) as cv_count
     FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL`,
    [TALENT_ID],
  ).catch(() => ({ rows: [{ total: 0, cv_count: 0 }] }));

  const skillBody = getSkillBody('natural-language-vocal-coach');
  if (!skillBody) throw new Error('Missing natural-language-vocal-coach skill body');
  const docs = docsRes.rows[0];

  return {
    talentId: TALENT_ID,
    talentName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    profile: {
      id: TALENT_ID,
      email: profile.email || '',
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      city: profile.city,
      country: profile.country,
      remoteReady: profile.remote_ready || false,
      skills: skillsRes.rows.map((s: any) => ({ name: s.name, level: s.level, type: s.type })),
      languages: langsRes.rows.map((l: any) => ({ language: l.language, level: l.level })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    documents: {
      totalCount: parseInt(docs.total) || 0,
      documents: [],
      hasCV: parseInt(docs.cv_count) > 0,
      hasDiplomas: false,
      hasCertificates: false,
    },
    applications: { totalCount: 0, activeCount: 0, applications: [], byStatus: {} },
    memberships: { totalCount: 0, memberships: [], adminOf: [] },
    session: { currentMode: 'study', conversationTopic: 'English interview practice' },
    language: LANGUAGE,
    activeSkillInstructions: skillBody,
    contextLoadedAt: new Date().toISOString(),
    contextVersion: '1.0',
  } as TalentContext;
}

function firstUserMessage(messages: any[]): string {
  const u = messages.find((m) => m.role === 'user');
  return typeof u?.content === 'string' ? u.content : '';
}

async function runAgentTurn(agent: AgentConfig, history: Array<{ role: string; content: string }>, userContent: string): Promise<AgentTurnResult> {
  const toolCalls: ToolCallCapture[] = [];
  const errors: string[] = [];
  let output = '';
  const perToolCounts = new Map<string, number>();
  const sqlIntentCounts = new Map<string, number>();

  const client = getChatClient();
  const messages: any[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: 'user' as const, content: userContent }];
  const initialToolChoice = inferInitialToolChoice(agent.mode, firstUserMessage(messages));
  const requiredCompletionTool = inferRequiredCompletionTool(agent.mode, firstUserMessage(messages));
  let requiredToolRetryUsed = false;

  if (initialToolChoice && typeof initialToolChoice === 'object' && initialToolChoice.type === 'function') {
    output += buildToolPreface(initialToolChoice.function.name);
  }

  for (let turnCount = 0; turnCount < AGENTIC_LIMITS.maxTurns; turnCount++) {
    const response = await client.chat.completions.create({
      model: agent.model,
      messages: [{ role: 'system' as const, content: buildAgentSystemText(agent) }, ...messages],
      tools: buildChatCompletionTools(agent.tools),
      tool_choice: turnCount === 0 ? initialToolChoice || 'auto' : 'auto',
      ...getAgentCompletionOptions(),
    });

    const responseMessage = response.choices[0]?.message;
    output += responseMessage?.content || '';
    const toolUseBlocks = responseMessage?.tool_calls || [];

    if (toolUseBlocks.length === 0 && requiredCompletionTool && !requiredToolRetryUsed && !toolCalls.some((tc) => tc.name === requiredCompletionTool)) {
      requiredToolRetryUsed = true;
      messages.push(responseMessage);
      messages.push({ role: 'user' as const, content: buildMissingRequiredToolMessage(requiredCompletionTool) });
      continue;
    }
    if (toolUseBlocks.length === 0) break;

    messages.push(responseMessage);
    const toolResults: any[] = [];
    for (const toolUse of toolUseBlocks) {
      const toolName = (toolUse as any).function?.name;
      const toolArgs = JSON.parse((toolUse as any).function?.arguments || '{}');
      const toolNameCount = (perToolCounts.get(toolName) || 0) + 1;
      perToolCounts.set(toolName, toolNameCount);
      toolCalls.push({ name: toolName, args: toolArgs, output: null });

      let result: any;
      try {
        const limit = enforceToolCallLimit({ toolName, toolInput: toolArgs, toolNameCount, sqlIntentCounts });
        if (limit.limited) {
          result = limit.output;
        } else {
          const toolDef = agent.tools.find((t) => t.definition.name === toolName);
          result = toolDef ? await toolDef.execute(toolArgs) : { error: `Unknown tool: ${toolName}` };
        }
      } catch (err: any) {
        result = { error: err.message };
      }

      const lastCall = [...toolCalls].reverse().find((tc) => tc.name === toolName && tc.output === null);
      if (lastCall) { lastCall.output = result; lastCall.durationMs = 0; }
      if (result?.error) errors.push(`${toolName}: ${result.error}`);
      toolResults.push({ role: 'tool', tool_call_id: (toolUse as any).id, content: JSON.stringify(result) });
    }
    messages.push(...toolResults);
  }

  return { output, toolCalls, errors };
}

function countComponents(text: string): number {
  const matches = text.match(/```(quiz|flashcard|youtube|diagram|image|chart|math|steps|exercise|playground|canvas|skills|audio_tts|confirmation|code)\b/g);
  return matches ? matches.length : 0;
}

function extractAudioBlocks(text: string): Array<{ text: string; instructions?: string; voice?: string; raw: string }> {
  const blocks: Array<{ text: string; instructions?: string; voice?: string; raw: string }> = [];
  const re = /```audio_tts\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1].trim();
    try {
      blocks.push({ ...JSON.parse(raw), raw });
    } catch {
      blocks.push({ text: '', raw });
    }
  }
  return blocks;
}

function containsFrenchInAudio(text: string): boolean {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\b(je|tu|vous|nous|bonjour|repete|repeter|phrase|anglais|francais|entretien|voudrais|comme|avec)\b/.test(normalized);
}

function makeChecks(turns: Array<{ label: string; output: string; tools: ToolCallCapture[]; errors: string[] }>): Check[] {
  const first = turns[0];
  const second = turns[1];
  const firstAudio = extractAudioBlocks(first.output);
  const secondAudio = extractAudioBlocks(second.output);
  const allTools = turns.flatMap((t) => t.tools.map((x) => x.name));
  const allOutput = turns.map((t) => t.output).join('\n');

  return [
    {
      check: 'Skill-specific vocal coach injected',
      pass: true,
      detail: 'natural-language-vocal-coach activeSkillInstructions set in test context',
    },
    {
      check: 'First turn emits exactly one audio_tts',
      pass: firstAudio.length === 1 && countComponents(first.output) === 1,
      detail: `audio=${firstAudio.length}; components=${countComponents(first.output)}`,
    },
    {
      check: 'First audio is target-language only',
      pass: !!firstAudio[0]?.text && !containsFrenchInAudio(firstAudio[0].text),
      detail: firstAudio[0]?.text ? `"${firstAudio[0].text.slice(0, 80)}"` : 'missing/invalid audio JSON',
    },
    {
      check: 'First turn asks for a voice note',
      pass: first.output.includes('🎙') && /vocal/i.test(first.output),
      detail: first.output.includes('🎙') ? 'mic CTA present' : 'missing mic CTA',
    },
    {
      check: 'Voice-practice turn keeps correction loop with audio_tts',
      pass: secondAudio.length === 1 && second.output.includes('🎙'),
      detail: `audio=${secondAudio.length}; mic=${second.output.includes('🎙')}`,
    },
    {
      check: 'No quiz/video/default passive content',
      pass: !/```(quiz|youtube)\b/.test(allOutput) && !allTools.includes('youtube_search'),
      detail: `tools=[${allTools.join(', ') || 'none'}]`,
    },
    {
      check: 'No premature skill update',
      pass: !allTools.includes('manage_skills'),
      detail: allTools.includes('manage_skills') ? 'manage_skills called' : 'manage_skills not called',
    },
    {
      check: 'No tool/runtime errors',
      pass: turns.every((t) => t.errors.length === 0),
      detail: turns.flatMap((t) => t.errors).join('; ') || 'none',
    },
  ];
}

function printReport(turns: Array<{ label: string; user: string; output: string; tools: ToolCallCapture[]; errors: string[] }>, checks: Check[]) {
  header('LANGUAGE STEERING REPORT');
  for (const t of turns) {
    section(t.label);
    console.log(`  User: "${t.user.slice(0, 120)}"`);
    console.log(`  Tools: ${t.tools.map((x) => x.name).join(', ') || 'none'}`);
    console.log(`  Components: ${countComponents(t.output)} | audio_tts: ${extractAudioBlocks(t.output).length}`);
    console.log(`  ${C.dim}Output preview: ${t.output.slice(0, 260).replace(/\n/g, ' ')}${C.reset}`);
  }

  header('SCORECARD');
  let pass = 0;
  for (const c of checks) {
    log(c.pass ? 'green' : 'red', `  [${c.pass ? 'PASS' : 'FAIL'}] ${c.check}`);
    console.log(`        ${C.dim}${c.detail}${C.reset}`);
    if (c.pass) pass++;
  }
  log(pass === checks.length ? 'green' : 'red', `  OVERALL: ${pass === checks.length ? 'PASS' : 'FAIL'} (${pass}/${checks.length})`);
}

async function main() {
  header('STUDY LANGUAGE STEERING HARNESS');
  const ctx = await buildLanguageContext();
  const agent = createTalentAgent(ctx);
  const history: Array<{ role: string; content: string }> = [];
  const turns: Array<{ label: string; user: string; output: string; tools: ToolCallCapture[]; errors: string[] }> = [];

  const user1 = "Je veux apprendre l'anglais pour un entretien. Fais-moi pratiquer à l'oral.";
  const r1 = await runAgentTurn(agent, history, user1);
  turns.push({ label: 'Turn 1 — oral kickoff', user: user1, output: r1.output, tools: r1.toolCalls, errors: r1.errors });
  history.push({ role: 'user', content: user1 }, { role: 'assistant', content: r1.output });

  const user2 = `📝 **Transcription:** Hello, my name is Lamine. I want work as developer.
🗣️ **Langue:** English
🔍 **Analyse:** Prononciation compréhensible, hésitation sur "want to work".
✅ **Corrections:** I want to work as a developer.
💪 **Encouragement:** Bon effort.
---
**Message de l'utilisateur à traiter par l'assistant:** Hello, my name is Lamine. I want work as developer.`;
  const r2 = await runAgentTurn(agent, history, user2);
  turns.push({ label: 'Turn 2 — voice correction loop', user: user2, output: r2.output, tools: r2.toolCalls, errors: r2.errors });

  const checks = makeChecks(turns);
  printReport(turns, checks);

  await pool.end();
  if (!checks.every((c) => c.pass)) process.exit(1);
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
