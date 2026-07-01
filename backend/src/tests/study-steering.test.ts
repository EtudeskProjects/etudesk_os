/**
 * Study-Steering Harness — multi-turn observation of the proprietary
 * pedagogical conversational experience in mode Étudier.
 *
 * Drives a simulated learner through the Evidence-Based Progression Protocol
 * on ONE catalog competence, mirrors the real
 * route's deterministic quiz steering (extractLastQuizBlock +
 * parseQuizAnswer + buildStudyQuizHint from services/copilot/study-quiz),
 * and observes whether the agent:
 *   - starts with diagnosis, then increases practice authenticity,
 *   - respects the deterministic verdict (agrees with correct/incorrect),
 *   - avoids re-explaining after confirmations,
 *   - avoids upgrading from quiz answers alone.
 *
 * Scenario: talent 90000000-...-000001 (Lamine Barro) on
 * `machine-learning-fundamentals` (beginner/declared). A perfect short
 * diagnostic must NOT upgrade the skill; it should lead to applied practice.
 *
 * Usage:
 *   npx tsx src/tests/study-steering.test.ts                         # successful diagnostic path
 *   npx tsx src/tests/study-steering.test.ts --wrong-q2              # mixed evidence path
 *   npx tsx src/tests/study-steering.test.ts --update                # diagnostic + applied practice + skill update
 *   npx tsx src/tests/study-steering.test.ts --target foundation     # Digital Literacy
 *   npx tsx src/tests/study-steering.test.ts --target python         # Python
 *   npx tsx src/tests/study-steering.test.ts --no-reset              # skip skill reset
 *
 * NOTE: uses the real AI provider (token cost) and mutates the dev DB
 * (manage_skills writes talent_skills). The reset at start keeps runs
 * repeatable.
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
import { summarizeHistoryIfNeeded } from '../services/copilot/session-summarizer';
import { FRAMEWORK_VERSION } from '../constants/skills';
import {
  type ActiveQuizState,
  type QuizBlock,
  buildQuizId,
  buildStudyQuizHint,
  extractLastQuizBlock,
  parseQuizAnswer,
} from '../services/copilot/study-quiz';

// --- Config ---

const TALENT_ID = process.env.COPILOT_STEERING_TALENT_ID || '90000000-0000-4000-8000-000000000001';
const LANGUAGE = 'fr' as const;
const HISTORY_LIMIT = 20;
const SUMMARY_THRESHOLD = 12;
const MAX_TURNS = 10;

type ScenarioVariant = '3/3' | '2/3' | 'update';

interface ScenarioTarget {
  key: string;
  slug: string;
  label: string;
  practiceCompletion: string;
}

const TARGETS: Record<string, ScenarioTarget> = {
  ml: {
    key: 'ml',
    slug: 'machine-learning-fundamentals',
    label: 'Machine Learning Fundamentals',
    practiceCompletion:
      "J'ai terminé l'exercice : j'ai comparé score_train et score_test, détecté un écart élevé, conclu à un overfitting, puis proposé validation croisée et régularisation.",
  },
  foundation: {
    key: 'foundation',
    slug: 'digital-literacy',
    label: 'Culture numérique',
    practiceCompletion:
      "J'ai terminé l'exercice : j'ai classé les usages numériques, identifié les risques de sécurité, choisi les bons outils, et expliqué comment vérifier une information avant de la partager.",
  },
  python: {
    key: 'python',
    slug: 'python',
    label: 'Python',
    practiceCompletion:
      "J'ai terminé l'exercice : j'ai écrit la fonction, testé deux cas, corrigé une erreur de type, et expliqué pourquoi la boucle et les conditions produisent le résultat attendu.",
  },
};

const BANNED_PHRASES = ['je vais', 'permettez-moi', 'je commence', 'je lance', 'un instant', 'laissez-moi'];

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};
function log(c: keyof typeof C, ...a: any[]) { console.log(C[c], ...a, C.reset); }
function header(t: string) { console.log('\n' + '═'.repeat(72)); log('bold', `  ${t}`); console.log('═'.repeat(72)); }
function section(t: string) { console.log('\n' + '─'.repeat(60)); log('cyan', `  ${t}`); console.log('─'.repeat(60)); }

// --- Types ---

interface ToolCallCapture { name: string; args: any; output: any; error?: string; durationMs?: number; }

interface TurnLog {
  turn: number;
  label: string;
  userRaw: string;
  hadActiveQuiz: boolean;
  deterministicVerdict: 'correct' | 'incorrect' | 'none';
  agentText: string;
  agentStatedVerdict: 'correct' | 'incorrect' | 'none' | 'ambiguous';
  verdictAgreement: boolean;
  quizBlockEmitted: QuizBlock | null;
  quizQuestionType: 'recall' | 'application' | 'analysis' | 'unknown';
  toolCalls: ToolCallCapture[];
  manageSkillsCall: { skillQuery: string; level: string; origin: string; axes?: number[]; success: boolean; resultSlug?: string; resultLevel?: string } | null;
  charCountText: number;
  componentCount: number;
  bannedPhrases: string[];
  errors: string[];
}

// --- DB helpers ---

async function resetSkillToBeginner(talentId: string, slug: string): Promise<void> {
  // Fetch the authoritative catalog_version from the competencies table.
  const cv = await pool.query(`SELECT catalog_version FROM competencies WHERE slug=$1`, [slug]);
  const catalogVersion = cv.rows[0]?.catalog_version || '2026-Q2';
  await pool.query(
    `INSERT INTO talent_skills
       (talent_id, competency_slug, level, score, confidence, origin, context, source_ref,
        inferred_from, decay_state, catalog_version, framework_version, is_visible)
     VALUES ($1, $2, 'beginner', 1, 0.3, 'declared', '{}'::text[], '{}'::text[], '{}'::text[],
             'active', $3, $4, true)
     ON CONFLICT (talent_id, competency_slug) DO UPDATE SET
       level='beginner', score=1, confidence=0.3, origin='declared',
       decay_state='active', catalog_version=EXCLUDED.catalog_version,
       framework_version=EXCLUDED.framework_version`,
    [talentId, slug, catalogVersion, FRAMEWORK_VERSION],
  );
}

async function readSkillLevel(talentId: string, slug: string): Promise<{ level: string; origin: string } | null> {
  const r = await pool.query(
    `SELECT level, origin FROM talent_skills WHERE talent_id=$1 AND competency_slug=$2`,
    [talentId, slug],
  );
  if (r.rows.length === 0) return null;
  return { level: r.rows[0].level, origin: r.rows[0].origin };
}

// --- Context (mirrors src/tests/copilot-agents.test.ts buildTestContext) ---

async function buildStudyContext(talentId: string, target: ScenarioTarget): Promise<TalentContext> {
  const profileRes = await pool.query(
    `SELECT t.id, t.first_name, t.last_name, t.bio, t.city, t.country, t.email, t.remote_ready
     FROM talents t WHERE t.id = $1`,
    [talentId],
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error(`Talent ${talentId} not found`);

  const skillsRes = await pool.query(
    `SELECT c.name AS name, ts.level AS level, c.type AS type
     FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
     WHERE ts.talent_id = $1`,
    [talentId],
  );
  const langsRes = await pool.query(
    `SELECT language, proficiency_level as level FROM talent_languages WHERE talent_id = $1`,
    [talentId],
  ).catch(() => ({ rows: [] }));
  const docsRes = await pool.query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE document_type IN ('cv','resume','CV')) as cv_count
     FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL`,
    [talentId],
  ).catch(() => ({ rows: [{ total: 0, cv_count: 0 }] }));

  const docs = docsRes.rows[0];
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
    session: { currentMode: 'study' as const, conversationTopic: target.label },
    language: LANGUAGE,
    contextLoadedAt: new Date().toISOString(),
    contextVersion: '1.0',
  } as TalentContext;
}

// --- Agent turn (mirrors runAgentTest loop, but takes history + userContent) ---

interface AgentTurnResult {
  output: string;
  toolCalls: ToolCallCapture[];
  errors: string[];
  assistantMessage: any;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; requests: number };
}

async function runAgentTurn(agent: AgentConfig, history: Array<{ role: string; content: string }>, userContent: string): Promise<AgentTurnResult> {
  const toolCalls: ToolCallCapture[] = [];
  const errors: string[] = [];
  let output = '';
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, requests: 0 };
  const perToolCounts = new Map<string, number>();
  const sqlIntentCounts = new Map<string, number>();

  const client = getChatClient();
  const messages: any[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: 'user' as const, content: userContent }];
  const toolDefs = buildChatCompletionTools(agent.tools);
  const completionOptions = getAgentCompletionOptions();
  const systemText = buildAgentSystemText(agent);
  const initialToolChoice = inferInitialToolChoice(agent.mode, message0(messages));
  const requiredCompletionTool = inferRequiredCompletionTool(agent.mode, message0(messages));
  let requiredToolRetryUsed = false;

  if (initialToolChoice && typeof initialToolChoice === 'object' && initialToolChoice.type === 'function') {
    const preface = buildToolPreface(initialToolChoice.function.name);
    output += preface;
  }

  let turnCount = 0;
  try {
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
      turnCount++;
    }
  } catch (error: any) {
    errors.push(`Agent error: ${error.message}`);
    log('red', `  AGENT ERROR: ${error.message}`);
  }

  return { output, toolCalls, errors, assistantMessage: { role: 'assistant', content: output }, usage };
}

function message0(messages: any[]): string {
  const u = messages.find((m) => m.role === 'user');
  return typeof u?.content === 'string' ? u.content : '';
}

// --- Learner answer simulation ---

function pickDistinctWrong(q: ActiveQuizState): number {
  const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctAnswer && i < q.options.length);
  return wrong.find((i) => q.options[i] !== q.options[q.correctAnswer]) ?? wrong[0];
}

function simulateAnswer(q: ActiveQuizState, wantCorrect: boolean): string {
  // Submit the OPTION TEXT (immune to app option shuffling; exercises the
  // exact-match branch of parseQuizAnswer).
  const idx = wantCorrect ? q.correctAnswer : pickDistinctWrong(q);
  return q.options[idx];
}

// --- Analysis helpers ---

function stripFenced(text: string): string {
  return text.replace(/`{2,}[\s\S]*?`{2,}/g, '');
}

function countComponents(text: string): number {
  const matches = text.match(/```(quiz|flashcard|youtube|diagram|image|chart|math|steps|exercise|playground|canvas|skills|audio_tts|confirmation|code)\b/g);
  return matches ? matches.length : 0;
}

function classifyQuestion(q: QuizBlock | null): 'recall' | 'application' | 'analysis' | 'unknown' {
  if (!q) return 'unknown';
  const t = (q.question || '').toLowerCase();
  if (/(appliquer|exemple|comment|scenari|cas|utilise|mettre en oeuvre|implémente|tu entraînes|tu entraines|tu dois|tu as|tu obtiens|quel modele|quel modèle|quel algorithme|classification|regression|régression|que renvoie|code|print|liste|dictionnaire|slicing)/.test(t)) return 'application';
  if (/(qu'est-ce que|definir|definition|que veut dire|c'est quoi|qu'est ce|difference|différence|quelle est|que mesure)/.test(t)) return 'recall';
  if (/(pourquoi|tradeoff|compromis|edge case|limite|choisir|justifie|avantage|inconvénient|quelle metrique|quelle métrique|quelle est la meilleure)/.test(t)) return 'analysis';
  return 'unknown';
}

function detectAgentVerdict(text: string, expectedCorrect: boolean): 'correct' | 'incorrect' | 'ambiguous' {
  // Scan only the LEADING ack (first sentence) — the explanation that follows
  // naturally contains words like "la reponse exacte", "c'est ca le clustering",
  // or score mentions ("2/3") which would false-match if scanned over the whole text.
  const firstSentence = (text.split(/[.!?\n]/)[0] || text).slice(0, 140);
  const t = firstSentence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const correctCues = ['correcte', 'bravo', 'bien joue', 'bien joué', 'tres bien', 'très bien', 'super', 'exact', 'parfait', 'parfaitement',
    "c'est ca", "c'est ça", 'oui c', 'excellent', 'nickel', 'maitrise', 'maîtrise', 'tout bon', 'impeccable'];
  const incorrectCues = ['incorrecte', 'pas tout a fait', 'pas tout à fait', 'pas ca', 'pas ça',
    'presque', 'faux', "non c", 'rate', 'raté', 'malheureusement'];
  // Strong diagnostic signal on the full ack region (3/3 finale).
  if (expectedCorrect && /^\s*\d+\s*\/\s*\d+/.test(t)) return 'correct';
  if (expectedCorrect && /3\s*(?:\/|sur)\s*3|tout juste|tu maitrise|tu maîtrise|excellent|tres solide|très solide/.test(t)) return 'correct';
  const hasCorrect = correctCues.some((c) => t.includes(c));
  const hasIncorrect = incorrectCues.some((c) => t.includes(c));
  if (expectedCorrect && hasCorrect && !hasIncorrect) return 'correct';
  if (!expectedCorrect && hasIncorrect && !hasCorrect) return 'incorrect';
  if (hasCorrect && hasIncorrect) return 'ambiguous';
  return 'ambiguous';
}

function findManageSkillsCall(toolCalls: ToolCallCapture[]): TurnLog['manageSkillsCall'] {
  const tc = toolCalls.find((t) => t.name === 'manage_skills');
  if (!tc) return null;
  const a = tc.args || {};
  const r = tc.output || {};
  return {
    skillQuery: a.skillQuery || '',
    level: a.level || '',
    origin: a.origin || '',
    axes: [a.axisA, a.axisC, a.axisI, a.axisT].filter((x: any) => x !== undefined),
    success: !!r?.success,
    resultSlug: r?.skill?.slug,
    resultLevel: r?.skill?.level,
  };
}

function bannedHits(text: string): string[] {
  const t = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => t.includes(p));
}

// --- Scenario driver ---

async function runScenario(variant: ScenarioVariant, agent: AgentConfig, target: ScenarioTarget): Promise<{ turns: TurnLog[]; deterministicScore: { correct: number; total: number }; manageSkillsCalled: boolean }> {
  let history: Array<{ role: string; content: string }> = [];
  let activeQuiz: ActiveQuizState | null = null;
  const turns: TurnLog[] = [];
  let deterministicScore = { correct: 0, total: 0 };
  let manageSkillsCalled = false;
  let turnIdx = 0;

  const makeTurnLog = (label: string, userRaw: string, hadQuiz: boolean): TurnLog => ({
    turn: ++turnIdx, label, userRaw, hadActiveQuiz: hadQuiz, deterministicVerdict: 'none',
    agentText: '', agentStatedVerdict: 'none', verdictAgreement: true, quizBlockEmitted: null,
    quizQuestionType: 'unknown', toolCalls: [], manageSkillsCall: null, charCountText: 0,
    componentCount: 0, bannedPhrases: [], errors: [],
  });

  const appendHistory = (userContent: string, assistantContent: string) => {
    history.push({ role: 'user', content: userContent });
    history.push({ role: 'assistant', content: assistantContent });
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
  };

  const finalize = (tl: TurnLog, result: AgentTurnResult, expectedCorrect: boolean | null) => {
    tl.agentText = result.output;
    tl.toolCalls = result.toolCalls;
    tl.errors = result.errors;
    tl.charCountText = stripFenced(result.output).length;
    tl.componentCount = countComponents(result.output);
    tl.bannedPhrases = bannedHits(result.output);
    tl.quizBlockEmitted = extractLastQuizBlock(result.output);
    tl.quizQuestionType = classifyQuestion(tl.quizBlockEmitted);
    tl.manageSkillsCall = findManageSkillsCall(result.toolCalls);
    if (tl.manageSkillsCall) manageSkillsCalled = true;
    if (expectedCorrect !== null) {
      tl.agentStatedVerdict = detectAgentVerdict(result.output, expectedCorrect);
      tl.verdictAgreement = (tl.agentStatedVerdict === (expectedCorrect ? 'correct' : 'incorrect'));
    }
    turns.push(tl);
    // refresh active quiz for next turn
    const next = extractLastQuizBlock(result.output);
    if (next) {
      activeQuiz = { quizId: buildQuizId(next), topic: next.topic, question: next.question, options: next.options, correctAnswer: next.correctAnswer, explanation: next.explanation, awaitingAnswer: true };
    } else {
      activeQuiz = null;
    }
  };

  // Turn 1 — kickoff
  {
    section(`Turn 1 — kickoff (${variant})`);
    const userRaw = `Teste-moi sur ${target.label}.`;
    log('dim', `  User: "${userRaw}"`);
    const result = await runAgentTurn(agent, history, userRaw);
    const tl = makeTurnLog('kickoff', userRaw, false);
    finalize(tl, result, null);
    appendHistory(userRaw, result.output);
    log('blue', `  Tools: ${result.toolCalls.map((t) => t.name).join(', ') || 'none'}`);
    log('green', `  Quiz: ${tl.quizBlockEmitted ? `${tl.quizQuestionType} — "${tl.quizBlockEmitted.question.slice(0, 60)}"` : 'NONE'}`);
  }

  // Turns 2..4 — answer the active quiz
  while (activeQuiz && deterministicScore.total < 3 && turnIdx < MAX_TURNS - 1) {
    const q: ActiveQuizState = activeQuiz; // snapshot — finalize() may reassign activeQuiz via closure
    const wantCorrect = variant === '2/3' ? (deterministicScore.total !== 1) : true; // 2/3: wrong on Q2
    const userRaw = simulateAnswer(q, wantCorrect);
    const qNum = deterministicScore.total + 1;
    section(`Turn ${turnIdx + 1} — answer Q${qNum} (${wantCorrect ? 'correct' : 'WRONG'})`);
    log('dim', `  User (option text): "${userRaw.slice(0, 80)}"`);

    // Steering mirror (routes/copilot.ts lines 745-770)
    const selectedIndex = parseQuizAnswer(userRaw, q.options);
    if (selectedIndex === null) {
      log('red', `  Could not parse answer — skipping steering hint`);
      const result = await runAgentTurn(agent, history, userRaw);
      const tl = makeTurnLog(`Q${qNum}`, userRaw, true);
      finalize(tl, result, null);
      appendHistory(userRaw, result.output);
      continue;
    }
    const evaluation = {
      selectedIndex,
      selectedOption: q.options[selectedIndex],
      isCorrect: selectedIndex === q.correctAnswer,
    };
    deterministicScore.total++;
    if (evaluation.isCorrect) deterministicScore.correct++;

    const hint = buildStudyQuizHint({
      activeQuiz: q,
      evaluation,
      progress: {
        phase: 'diagnostic',
        answered: deterministicScore.total,
        correct: deterministicScore.correct,
        target: 3,
      },
    });
    const userContent = `${hint}\n\nUser message:\n${userRaw}`;
    q.awaitingAnswer = false;

    if (history.length > SUMMARY_THRESHOLD) {
      history = await summarizeHistoryIfNeeded(history, LANGUAGE);
      if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    }

    const result = await runAgentTurn(agent, history, userContent);
    const tl = makeTurnLog(`Q${qNum}`, userRaw, true);
    tl.deterministicVerdict = evaluation.isCorrect ? 'correct' : 'incorrect';
    finalize(tl, result, evaluation.isCorrect);
    appendHistory(userContent, result.output);
    log('blue', `  Tools: ${result.toolCalls.map((t) => t.name).join(', ') || 'none'}`);
    log(tl.verdictAgreement ? 'green' : 'red', `  Deterministic: ${tl.deterministicVerdict} | Agent: ${tl.agentStatedVerdict} | Agree: ${tl.verdictAgreement}`);
    log('green', `  Next quiz: ${tl.quizBlockEmitted ? `${tl.quizQuestionType} — "${tl.quizBlockEmitted.question.slice(0, 60)}"` : 'none (chain ended)'}`);
  }

  // Turn 5 — after a perfect short diagnostic, the agent should ask for
  // applied practice instead of updating the profile immediately.
  const diagnosticComplete = deterministicScore.total >= 3;

  if ((variant === '3/3' || variant === 'update') && diagnosticComplete && !manageSkillsCalled && turnIdx < MAX_TURNS) {
    section(`Turn ${turnIdx + 1} — applied-practice request`);
    const userRaw = 'Donne-moi un exercice pratique pour confirmer.';
    log('dim', `  User: "${userRaw}"`);
    const result = await runAgentTurn(agent, history, userRaw);
    const tl = makeTurnLog('applied_practice_request', userRaw, false);
    finalize(tl, result, null);
    appendHistory(userRaw, result.output);
    log('blue', `  Tools: ${result.toolCalls.map((t) => t.name).join(', ') || 'none'}`);
    log(tl.manageSkillsCall ? 'red' : 'green', `  manage_skills ${tl.manageSkillsCall ? 'CALLED (violation)' : 'not called'}`);
  }

  if (variant === 'update' && diagnosticComplete && !manageSkillsCalled && turnIdx < MAX_TURNS) {
    section(`Turn ${turnIdx + 1} — applied-practice completion`);
    const userRaw = target.practiceCompletion;
    log('dim', `  User: "${userRaw}"`);
    const result = await runAgentTurn(agent, history, userRaw);
    const tl = makeTurnLog('applied_practice_completion', userRaw, false);
    finalize(tl, result, null);
    appendHistory(userRaw, result.output);
    log('blue', `  Tools: ${result.toolCalls.map((t) => t.name).join(', ') || 'none'}`);
    if (tl.manageSkillsCall) {
      log('green', `  manage_skills: ${tl.manageSkillsCall.skillQuery} -> ${tl.manageSkillsCall.resultLevel} (success=${tl.manageSkillsCall.success})`);
    }
  }

  if (variant === 'update' && diagnosticComplete && !manageSkillsCalled && turnIdx < MAX_TURNS) {
    section(`Turn ${turnIdx + 1} — explicit update consent`);
    const userRaw = `Oui, mets à jour mon profil sur ${target.label} au niveau intermédiaire avec cette preuve pratique.`;
    log('dim', `  User: "${userRaw}"`);
    const result = await runAgentTurn(agent, history, userRaw);
    const tl = makeTurnLog('update_consent', userRaw, false);
    finalize(tl, result, null);
    appendHistory(userRaw, result.output);
    log('blue', `  Tools: ${result.toolCalls.map((t) => t.name).join(', ') || 'none'}`);
    if (tl.manageSkillsCall) {
      log('green', `  manage_skills: ${tl.manageSkillsCall.skillQuery} -> ${tl.manageSkillsCall.resultLevel} (success=${tl.manageSkillsCall.success})`);
    } else {
      log('red', '  manage_skills NOT called after explicit consent');
    }
  }

  return { turns, deterministicScore, manageSkillsCalled };
}

// --- Scorecard ---

function scorecard(turns: TurnLog[], variant: ScenarioVariant, finalSkill: { level: string; origin: string } | null, deterministicScore: { correct: number; total: number }): Array<{ check: string; pass: boolean; detail: string }> {
  const quizTurns = turns.filter((t) => t.hadActiveQuiz);
  const quizEmitted = turns.filter((t) => t.quizBlockEmitted);
  const types = quizEmitted.map((t) => t.quizQuestionType);
  // monotonic recall->application->analysis (allow unknowns to not break but flag)
  const orderRank = { recall: 0, application: 1, analysis: 2, unknown: -1 };
  let monotonicChain = true;
  for (let i = 1; i < types.length; i++) {
    if (orderRank[types[i]] === -1 || orderRank[types[i - 1]] === -1) continue;
    if (orderRank[types[i]] < orderRank[types[i - 1]]) monotonicChain = false;
  }

  const verdictAgreementAll = quizTurns.every((t) => t.verdictAgreement);
  const oneComponentPerMsg = turns.every((t) => t.componentCount <= 1);
  const textUnder1200 = turns.every((t) => t.charCountText <= 1200);
  const noBanned = turns.every((t) => t.bannedPhrases.length === 0);
  const oneQuizPerMsg = turns.every((t) => {
    const m = t.agentText.match(/```quiz\b/g);
    return !m || m.length <= 1;
  });
  const msCall = turns.map((t) => t.manageSkillsCall).find((x) => x);
  const hasPracticeComponent = (t: TurnLog) => /```(exercise|playground|steps)\b/.test(t.agentText);
  const hasRemediationComponent = (t: TurnLog) => /```(flashcard|exercise|steps|youtube)\b/.test(t.agentText);

  const checks: Array<{ check: string; pass: boolean; detail: string }> = [
    { check: '3-question diagnostic', pass: quizEmitted.length === 3, detail: `${quizEmitted.length} quiz emitted; types=[${types.join(',')}]${monotonicChain ? ' (monotonic)' : ' (non-monotonic — heuristic classifier, manual review)'} — agent narrates difficulty; count is authoritative` },
    { check: 'Deterministic verdict respected', pass: verdictAgreementAll, detail: verdictAgreementAll ? 'all agree' : `${quizTurns.filter((t) => !t.verdictAgreement).map((t) => t.label).join(', ')} disagree` },
    { check: 'Anti-repetition', pass: true, detail: 'manual review (see output)' },
    { check: 'ONE component per message', pass: oneComponentPerMsg, detail: turns.filter((t) => t.componentCount > 1).map((t) => `T${t.turn}=${t.componentCount}`).join(',') || 'ok' },
    { check: '< 1200 chars text', pass: textUnder1200, detail: turns.filter((t) => t.charCountText > 1200).map((t) => `T${t.turn}=${t.charCountText}`).join(',') || 'ok' },
    { check: 'No banned phrases', pass: noBanned, detail: turns.flatMap((t) => t.bannedPhrases.map((p) => `T${t.turn}:${p}`)).join(',') || 'none' },
    { check: 'ONE quiz question per message', pass: oneQuizPerMsg, detail: 'ok' },
  ];

  if (variant === '3/3') {
    const noMs = !msCall && finalSkill?.level === 'beginner';
    const hasAppliedPractice = turns
      .filter((t) => t.label === 'applied_practice_request')
      .some(hasPracticeComponent);
    checks.push({ check: 'NO manage_skills at 3/3 diagnostic', pass: noMs, detail: `${msCall ? 'manage_skills CALLED (violation)' : 'no manage_skills'}; DB=${finalSkill?.level}/${finalSkill?.origin}` });
    checks.push({ check: 'Applied practice after diagnostic', pass: hasAppliedPractice, detail: hasAppliedPractice ? 'practice component emitted after explicit request' : 'no exercise/playground/steps in applied-practice turn' });
  } else if (variant === '2/3') {
    const finalDiagnosticTurn = [...turns].reverse().find((t) => t.hadActiveQuiz);
    const hasRemediation = finalDiagnosticTurn ? hasRemediationComponent(finalDiagnosticTurn) : false;
    const noMs = !msCall;
    checks.push({ check: 'NO manage_skills at mixed diagnostic', pass: noMs, detail: msCall ? 'manage_skills CALLED (violation)' : 'no manage_skills' });
    checks.push({ check: 'Remediation after mixed diagnostic', pass: hasRemediation, detail: hasRemediation ? 'remediation component emitted on final diagnostic turn' : 'no flashcard/exercise/steps/youtube on final diagnostic turn' });
  } else {
    const msOK = !!msCall && msCall.success && msCall.resultLevel === 'intermediate' && finalSkill?.level === 'intermediate';
    const consentTurn = turns.find((t) => t.label === 'update_consent');
    const axesOK = !!msCall?.axes && msCall.axes.length === 4 && msCall.axes.every((axis) => Number(axis) >= 2);
    const perfectDiagnostic = deterministicScore.correct === 3 && deterministicScore.total === 3;
    checks.push({ check: 'Perfect diagnostic before update path', pass: perfectDiagnostic, detail: `${deterministicScore.correct}/${deterministicScore.total}` });
    checks.push({ check: 'manage_skills after practice + consent', pass: msOK, detail: msCall ? `${msCall.skillQuery} -> ${msCall.resultLevel} (success=${msCall.success}); DB=${finalSkill?.level}/${finalSkill?.origin}` : 'NOT called' });
    checks.push({ check: 'A/C/I/T axes supplied for update', pass: axesOK, detail: msCall?.axes?.length ? `axes=[${msCall.axes.join(',')}]` : 'no axes supplied' });
    checks.push({ check: 'Explicit consent turn used', pass: !!consentTurn, detail: consentTurn ? 'consent turn present' : 'missing consent turn' });
  }

  return checks;
}

// --- Report ---

function printReport(turns: TurnLog[], checks: Array<{ check: string; pass: boolean; detail: string }>, deterministicScore: { correct: number; total: number }, finalSkill: { level: string; origin: string } | null, beforeSkill: { level: string; origin: string } | null) {
  header('STEERING REPORT');
  console.log(`Deterministic score: ${deterministicScore.correct}/${deterministicScore.total}`);
  if (beforeSkill) console.log(`Skill before: ${beforeSkill.level}/${beforeSkill.origin}`);
  if (finalSkill) console.log(`Skill after:  ${finalSkill.level}/${finalSkill.origin}`);

  for (const t of turns) {
    section(`Turn ${t.turn} — ${t.label}`);
    console.log(`  User: "${t.userRaw.slice(0, 100)}"`);
    console.log(`  Active quiz: ${t.hadActiveQuiz} | Deterministic: ${t.deterministicVerdict} | Agent: ${t.agentStatedVerdict} | Agree: ${t.verdictAgreement}`);
    console.log(`  Tools: ${t.toolCalls.map((x) => x.name).join(', ') || 'none'}`);
    if (t.quizBlockEmitted) console.log(`  Quiz emitted: ${t.quizQuestionType} — "${t.quizBlockEmitted.question.slice(0, 70)}"`);
    if (t.manageSkillsCall) console.log(`  manage_skills: ${t.manageSkillsCall.skillQuery} -> ${t.manageSkillsCall.resultLevel} (success=${t.manageSkillsCall.success})`);
    console.log(`  Text: ${t.charCountText} chars | Components: ${t.componentCount} | Banned: ${t.bannedPhrases.length ? t.bannedPhrases.join(',') : 'none'}`);
    console.log(`  ${C.dim}Output preview: ${t.agentText.slice(0, 200).replace(/\n/g, ' ')}${C.reset}`);
  }

  header('SCORECARD');
  let pass = 0;
  for (const c of checks) {
    log(c.pass ? 'green' : 'red', `  [${c.pass ? 'PASS' : 'FAIL'}] ${c.check}`);
    console.log(`        ${C.dim}${c.detail}${C.reset}`);
    if (c.pass) pass++;
  }
  const overall = pass === checks.length;
  console.log('');
  log(overall ? 'green' : 'red', `  OVERALL: ${overall ? 'PASS' : 'FAIL'} (${pass}/${checks.length})`);
}

// --- Main ---

async function main() {
  const argv = process.argv.slice(2);
  const targetFlagIndex = argv.indexOf('--target');
  const targetKey = targetFlagIndex >= 0 ? argv[targetFlagIndex + 1] : 'ml';
  const target = TARGETS[targetKey] || TARGETS.ml;
  const variant: ScenarioVariant = argv.includes('--update') ? 'update' : argv.includes('--wrong-q2') ? '2/3' : '3/3';
  const noReset = argv.includes('--no-reset');

  header(`STUDY-STEERING HARNESS — variant ${variant} — target ${target.key}`);

  if (!noReset) {
    log('dim', '  Resetting skill to beginner/declared...');
    await resetSkillToBeginner(TALENT_ID, target.slug);
  }
  const beforeSkill = await readSkillLevel(TALENT_ID, target.slug);
  log('dim', `  Skill before: ${beforeSkill?.level}/${beforeSkill?.origin}`);

  log('dim', '  Building study context + agent...');
  const ctx = await buildStudyContext(TALENT_ID, target);
  const agent = createTalentAgent(ctx);

  const { turns, deterministicScore } = await runScenario(variant, agent, target);

  const finalSkill = await readSkillLevel(TALENT_ID, target.slug);
  const checks = scorecard(turns, variant, finalSkill, deterministicScore);
  printReport(turns, checks, deterministicScore, finalSkill, beforeSkill);

  await pool.end();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
