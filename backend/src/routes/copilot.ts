/**
 * Copilot API Routes
 * Routes for AI copilot chat and session management
 * Native Anthropic SDK + Claude + SSE Streaming
 */

import { Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  DOCUMENT_LIMITS,
  ALLOWED_MIME_TYPES,
} from '../constants/documents';
import { logger } from '../utils';
import { i18next } from '../i18n';
import { pool } from '../services/database';
import {
  uploadDocument,
  canUploadDocument,
  validateFile,
} from '../services/documents/document.service';
import { MODEL_STT } from '../services/ai/models';
import { analyzeAudio } from '../services/ai/audio-analysis.service';
import { generateTTS } from '../services/ai/tts.service';
import { uploadFile } from '../services/storage.service';
import {
  copilotService,
  createTalentAgent,
  createOrgAgent,
  initSSE,
  sendSSE,
  runAgentWithSSE,
  generateSessionTitle,
  generateSuggestions,
  loadTalentContext,
  COPILOT_MODES,
  type CopilotMode,
  type TalentContext,
  type OrgContext,
} from '../services/copilot';
import {
  EXPLORER_CONTEXT_OPTIONS,
  STUDY_CONTEXT_OPTIONS,
  ORG_CONTEXT_OPTIONS,
} from '../services/copilot/context-options';
import { detectSkillFromMessage } from '../services/copilot/skills/skill.loader';
import { isUEMOACountry, shouldInjectUEMOA } from '../services/copilot/uemoa-knowledge';
import { getWinningTrajectories, invalidateTrajectoryCache } from '../services/copilot/trace.service';
import { summarizeHistoryIfNeeded } from '../services/copilot/session-summarizer';
import { handleConfirmation } from '../services/copilot/actions/action.handler';
import { copilotChatLimiter, copilotGeneralLimiter } from '../middleware/rateLimit.middleware';
import { debitWalletForAction } from '../services/billing/credit.service';
import { cache } from '../utils/cache';
import { getLanguageDisplayName, resolveTalentLanguage } from '../services/language-preference.service';

const router = Router();

function buildDeterministicSessionTitle(
  message: string,
  language: string,
  hasAttachments: boolean
): string | null {
  const normalized = message.trim().toLowerCase();

  if (!normalized && hasAttachments) {
    return language === 'fr' ? 'Analyse de document' : 'Document analysis';
  }

  const onboardingTriggers = new Set([
    "c'est parti",
    "c'est parti !",
    'lets go',
    "let's go",
    'get started',
    'start onboarding',
  ]);
  if (onboardingTriggers.has(normalized)) {
    return language === 'fr' ? 'Onboarding Etudesk' : 'Etudesk onboarding';
  }

  const genericReplies = new Set(['oui', 'yes', 'ok', 'okay', 'daccord', "d'accord"]);
  if (genericReplies.has(normalized)) {
    return null;
  }

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return language === 'fr' ? 'Analyse de document' : 'Document analysis';
  }

  return null;
}
const MEMORY_MAX_SESSIONS = 12;
const MEMORY_MAX_MESSAGES = 120;
const MEMORY_MAX_SNIPPETS = 6;
const MEMORY_MIN_TEXT_LEN = 30;

/** Sanitize strings before PostgreSQL insertion — removes null bytes and fixes broken Unicode escapes */
function sanitizeForPg(value: string | null | undefined): string | null {
  if (!value) return value as null;
  return value
    // Remove actual null bytes
    .replace(/\u0000/g, '')
    // Remove escaped null bytes
    .replace(/\\u0000/g, '')
    // Remove invalid Unicode escape sequences (e.g. \uD800-\uDFFF surrogates, \uXXXX invalid)
    .replace(/\\u[dD][89abAB][0-9a-fA-F]{2}/g, '')
    // Remove lone surrogates in the actual string
    .replace(/[\uD800-\uDFFF]/g, '');
}
function sanitizeJsonForPg(value: any): string | null {
  if (!value) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return sanitizeForPg(str);
}

interface QuizBlock {
  topic?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface ActiveQuizState {
  quizId: string;
  topic?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  sourceMessageId?: string;
  sourceMessageAt?: string;
  awaitingAnswer: boolean;
}

interface QuizEvaluation {
  selectedIndex: number;
  selectedOption: string;
  isCorrect: boolean;
}

function normalizeQuizText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toQuizLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function buildQuizId(quiz: QuizBlock): string {
  const payload = `${quiz.topic || ''}|${quiz.question}|${quiz.options.join('|')}|${quiz.correctAnswer}`;
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

function parseQuizBlock(raw: string): QuizBlock | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    const options = Array.isArray(parsed.options)
      ? parsed.options.map((o: any) => String(o || '').trim()).filter(Boolean)
      : [];
    const correctAnswer = Number(parsed.correctAnswer);

    if (!question || options.length < 2) return null;
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) return null;

    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic.trim() : undefined,
      question,
      options,
      correctAnswer,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function extractLastQuizBlock(content: string): QuizBlock | null {
  const regex = /```quiz\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let last: QuizBlock | null = null;

  while ((match = regex.exec(content)) !== null) {
    const parsed = parseQuizBlock(match[1].trim());
    if (parsed) last = parsed;
  }

  return last;
}

function parseQuizAnswer(userMessage: string, options: string[]): number | null {
  const raw = userMessage.trim();
  if (!raw || options.length === 0) return null;

  // A) / A. / A: / "Option A" / "Réponse A"
  const letterMatch = raw.match(/^(?:option|reponse|réponse)?\s*([A-Z])(?:[\)\].:\s-]|$)/i);
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  // "1", "2", ...
  const numMatch = raw.match(/^([1-9][0-9]*)\s*$/);
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (idx >= 0 && idx < options.length) return idx;
  }

  const normalizedRaw = normalizeQuizText(raw.replace(/^[A-Z]\)\s*/i, ''));
  if (!normalizedRaw) return null;

  // Exact option text
  const exact = options.findIndex((o) => normalizeQuizText(o) === normalizedRaw);
  if (exact >= 0) return exact;

  // Containment fallback (only if unique)
  const candidates = options
    .map((o, i) => ({ i, n: normalizeQuizText(o) }))
    .filter((o) => normalizedRaw.includes(o.n) || o.n.includes(normalizedRaw));
  return candidates.length === 1 ? candidates[0].i : null;
}

async function getLatestAssistantMessage(sessionId: string): Promise<{ id: string; createdAt: string; content: string } | null> {
  const result = await pool.query(
    `SELECT id, created_at, content
     FROM copilot_messages
     WHERE session_id = $1 AND role = 'assistant' AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [sessionId]
  );

  if (result.rows.length === 0) return null;
  return {
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at,
    content: result.rows[0].content || '',
  };
}

async function persistSessionContext(sessionId: string, context: Record<string, unknown>): Promise<void> {
  await pool.query(
    `UPDATE copilot_sessions
     SET context = $2::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [sessionId, JSON.stringify(context || {})]
  );
}

interface ConfirmationBlockPayload {
  action?: string;
  entity_id?: string;
  title?: string;
  description?: string;
  confirm_label?: string;
  cancel_label?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function formatYmdInAbidjan(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function userRefersToTomorrow(message?: string): boolean {
  if (!message) return false;
  const normalized = normalizeTextForMatch(message);
  return /\b(demain|tomorrow)\b/.test(normalized);
}

function normalizeAgendaTriggerDueAtFromUserMessage(
  payload: ConfirmationBlockPayload,
  userMessage?: string
): ConfirmationBlockPayload {
  if (payload.action !== 'create_agenda_trigger') return payload;
  if (!payload.data || typeof payload.data !== 'object') return payload;
  if (!userRefersToTomorrow(userMessage)) return payload;

  const rawDueAt = payload.data.dueAt || payload.data.due_at;
  if (typeof rawDueAt !== 'string') return payload;

  const dueAt = new Date(rawDueAt);
  if (Number.isNaN(dueAt.getTime())) return payload;

  const now = new Date();
  const dueYmd = formatYmdInAbidjan(dueAt);
  const todayYmd = formatYmdInAbidjan(now);
  if (dueYmd !== todayYmd) return payload;

  const shifted = new Date(dueAt.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + 1);

  return {
    ...payload,
    data: {
      ...payload.data,
      dueAt: shifted.toISOString(),
    },
  };
}

function normalizeConfirmationPayload(payload: ConfirmationBlockPayload, userMessage?: string): ConfirmationBlockPayload {
  const normalized: ConfirmationBlockPayload = {
    ...payload,
    entity_id: typeof payload.entity_id === 'string' ? payload.entity_id.trim() : '',
  };

  if (normalized.action === 'create_agenda_trigger' && !normalized.entity_id) {
    normalized.entity_id = 'self';
  }

  return normalizeAgendaTriggerDueAtFromUserMessage(normalized, userMessage);
}

function normalizeConfirmationBlocks(content: string, userMessage?: string): string {
  if (!content || !content.includes('```confirmation')) return content;

  return content.replace(/```confirmation\s*([\s\S]*?)```/g, (fullMatch, rawBlock: string) => {
    try {
      const parsed = JSON.parse(rawBlock.trim()) as ConfirmationBlockPayload;
      const normalized = normalizeConfirmationPayload(parsed, userMessage);
      return `\`\`\`confirmation\n${JSON.stringify(normalized)}\n\`\`\``;
    } catch {
      return fullMatch;
    }
  });
}

function extractLastConfirmationBlock(content: string): { rawBlock: string; confirmLabel?: string } | null {
  const regex = /```confirmation\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let last: { rawBlock: string; confirmLabel?: string } | null = null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = normalizeConfirmationPayload(JSON.parse(raw) as ConfirmationBlockPayload);
      last = {
        rawBlock: `\`\`\`confirmation\n${JSON.stringify(parsed)}\n\`\`\``,
        confirmLabel: typeof parsed?.confirm_label === 'string' ? parsed.confirm_label.trim() : undefined,
      };
    } catch {
      // Ignore malformed confirmation blocks
    }
  }

  return last;
}

function buildStudyQuizHint(params: { activeQuiz: ActiveQuizState; evaluation: QuizEvaluation }): string {
  const { activeQuiz, evaluation } = params;
  const optionsBlock = activeQuiz.options
    .map((opt, idx) => `${toQuizLetter(idx)}) ${opt}`)
    .join('\n');

  return [
    '[DETERMINISTIC_QUIZ_CONTEXT]',
    'You must evaluate ONLY the currently active quiz below.',
    'Do not re-evaluate older questions and do not mix with previous answers.',
    `quiz_id=${activeQuiz.quizId}`,
    `question=${activeQuiz.question}`,
    'options:',
    optionsBlock,
    `correct_index=${activeQuiz.correctAnswer}`,
    `user_selected_index=${evaluation.selectedIndex}`,
    `user_selected_option=${evaluation.selectedOption}`,
    `is_correct=${evaluation.isCorrect ? 'true' : 'false'}`,
    'Instruction: acknowledge this specific answer, explain briefly, then continue to the next pedagogical step.',
    '[/DETERMINISTIC_QUIZ_CONTEXT]',
  ].join('\n');
}

function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericVoicePlaceholder(message: string): boolean {
  const normalized = normalizeTextForMatch(message);
  return [
    '',
    'note vocale',
    'message vocal',
    'message vocal enregistre',
    'voice note',
    'audio message',
    'vocal',
  ].includes(normalized);
}

function buildStoredUserMessage(message: string, voiceNoteAnalysis?: string): string {
  if (!voiceNoteAnalysis) return message;
  return isGenericVoicePlaceholder(message)
    ? voiceNoteAnalysis
    : `${message}\n\n${voiceNoteAnalysis}`;
}

function userReportsMissingConfirmationBlock(message: string): boolean {
  const normalized = normalizeTextForMatch(message);
  if (!normalized) return false;

  const patterns = [
    /\bn\s*(?:e|')?\s*voi?s?\s+(?:aucun|pas de|pas le|pas)\s+(?:bloc|block|bloque|bloke|bouton|button)\b/,
    /\b(?:can(?:not| t)|cant|do not|dont)\s+see\s+(?:the\s+)?(?:block|button)\b/,
    /\b(?:ou|where)\s+(?:est|is)\s+(?:le\s+|the\s+)?(?:bloc|block|bouton|button)\b/,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function buildConfirmationReplayResponse(block: { rawBlock: string; confirmLabel?: string }, language?: string): string {
  const label = block.confirmLabel || (language === 'fr' ? 'Confirmer' : 'Confirm');
  if (language === 'fr') {
    return `Je remets le bloc ici. Appuie sur **${label}** pour valider.\n\n${block.rawBlock}`;
  }
  return `I am showing the block again here. Tap **${label}** to confirm.\n\n${block.rawBlock}`;
}

function extractMemoryKeywords(message: string): string[] {
  const stop = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'ou', 'en', 'a', 'au', 'aux',
    'pour', 'avec', 'sur', 'dans', 'par', 'que', 'qui', 'quoi', 'comment', 'est', 'sont', 'je',
    'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
    'notre', 'nos', 'votre', 'vos', 'ce', 'cet', 'cette', 'ces', 'the', 'a', 'an', 'and', 'or',
    'to', 'of', 'for', 'with', 'on', 'in', 'at', 'by', 'is', 'are', 'i', 'you', 'we', 'they',
    'my', 'your', 'our', 'their', 'this', 'that', 'these', 'those',
  ]);

  const words = normalizeTextForMatch(message)
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));

  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([w]) => w);
}

async function loadCrossSessionMemory(params: {
  talentId: string;
  organizationId?: string;
  currentSessionId: string;
  mode: CopilotMode;
  message: string;
  language?: string;
}): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: params.language, ...(options || {}) });
  const keywords = extractMemoryKeywords(params.message);
  if (keywords.length === 0) return [];

  const scopeResult = params.organizationId
    ? await pool.query(
        `SELECT id
         FROM copilot_sessions
         WHERE organization_id = $1
           AND deleted_at IS NULL
           AND id <> $2
         ORDER BY updated_at DESC
         LIMIT $3`,
        [params.organizationId, params.currentSessionId, MEMORY_MAX_SESSIONS]
      )
    : await pool.query(
        `SELECT id
         FROM copilot_sessions
         WHERE talent_id = $1
           AND organization_id IS NULL
           AND mode = $2
           AND deleted_at IS NULL
           AND id <> $3
         ORDER BY updated_at DESC
         LIMIT $4`,
        [params.talentId, params.mode, params.currentSessionId, MEMORY_MAX_SESSIONS]
      );

  const sessionIds = scopeResult.rows.map((r: any) => r.id).filter(Boolean);
  if (sessionIds.length === 0) return [];

  const messagesResult = await pool.query(
    `SELECT cm.session_id, cm.role, cm.content, cm.created_at
     FROM copilot_messages cm
     WHERE cm.session_id = ANY($1::uuid[])
       AND cm.deleted_at IS NULL
       AND cm.role IN ('user', 'assistant')
       AND length(cm.content) >= $2
     ORDER BY cm.created_at DESC
     LIMIT $3`,
    [sessionIds, MEMORY_MIN_TEXT_LEN, MEMORY_MAX_MESSAGES]
  );

  const scored = messagesResult.rows
    .map((r: any) => {
      const normalized = normalizeTextForMatch(r.content || '');
      let score = 0;
      for (const kw of keywords) {
        if (normalized.includes(kw)) score += 2;
      }
      if (r.role === 'assistant') score += 1;
      return { ...r, score };
    })
    .filter((r: any) => r.score > 0)
    .sort((a: any, b: any) => b.score - a.score || +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, MEMORY_MAX_SNIPPETS);

  if (scored.length === 0) return [];

  const snippets = scored.map((r: any, i: number) => {
    const roleLabel = r.role === 'assistant' ? tr('copilot:memoryRoleAssistant') : tr('copilot:memoryRoleUser');
    const clean = String(r.content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    return `${i + 1}. (${roleLabel}) ${clean}`;
  });

  const memoryBlock =
    `${tr('copilot:memoryBlockTitle')}\n` +
    `${tr('copilot:memoryBlockIntro')}\n` +
    snippets.map((s) => `- ${s}`).join('\n');

  return [
    { role: 'user', content: memoryBlock },
    { role: 'assistant', content: tr('copilot:memoryAck') },
  ];
}

async function getOrganizationBillingOwner(organizationId: string, talentId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT role, status
     FROM organization_members
     WHERE organization_id = $1 AND talent_id = $2
     LIMIT 1`,
    [organizationId, talentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const { role, status } = result.rows[0];
  if (status !== 'ACTIVE') {
    return null;
  }

  const allowedRoles = new Set(['OWNER', 'ADMIN', 'MANAGER', 'SUB_ADMIN']);
  if (!allowedRoles.has(String(role || '').toUpperCase())) {
    return null;
  }

  return organizationId;
}

async function isActiveOrganizationMember(organizationId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM organization_members
     WHERE organization_id = $1 AND talent_id = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [organizationId, talentId]
  );
  return result.rows.length > 0;
}

// --- Chat Endpoint — Sse Streaming ---

/**
 * POST /api/copilot/chat - Send a message to the copilot (SSE streaming)
 * Body: { sessionId?: string, message: string, mode?: 'explore' | 'study' | 'org', organizationId?: string }
 * Response: Server-Sent Events stream
 */
router.post('/chat', copilotChatLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { sessionId: inputSessionId, message, mode, organizationId, attachmentIds, replaceLastExchange, voiceNoteUrl, voiceNoteMimeType } = req.body;

    // Normalize message — default to empty string when attachments/voice present
    const safeMessage = (typeof message === 'string' ? message : '').trim();
    const hasAttachments = Array.isArray(attachmentIds) && attachmentIds.length > 0;
    const hasVoiceNote = !!voiceNoteUrl;

    // Validate: require message OR attachments OR voice note
    if (safeMessage.length === 0 && !hasAttachments && !hasVoiceNote) {
      return res.status(400).json({ error: req.t('copilot:messageRequired') });
    }

    if (safeMessage.length > 4000) {
      return res.status(400).json({ error: req.t('copilot:messageTooLong') });
    }

    // Validate mode
    const validMode: CopilotMode = Object.values(COPILOT_MODES).includes(mode as CopilotMode)
      ? (mode as CopilotMode)
      : COPILOT_MODES.EXPLORE;

    if (validMode === COPILOT_MODES.ORG && !organizationId) {
      return res.status(400).json({ error: req.t('copilot:orgIdRequired') });
    }

    const requestIdempotencyKeyHeader = req.headers['x-idempotency-key'];
    const requestIdempotencyKey = Array.isArray(requestIdempotencyKeyHeader)
      ? requestIdempotencyKeyHeader[0]
      : requestIdempotencyKeyHeader;

    const debitKey = requestIdempotencyKey
      ? `copilot_chat_${requestIdempotencyKey}`
      : `copilot_chat_${crypto.randomUUID()}`;

    try {
      if (organizationId) {
        const orgOwner = await getOrganizationBillingOwner(organizationId, talentId);
        if (!orgOwner) {
          return res.status(403).json({ error: req.t('organizations:notMember') });
        }

        await debitWalletForAction({
          scope: 'ORGANIZATION',
          ownerId: orgOwner,
          actionCode: 'ORG_ASSISTANT_MANAGER_QUERY',
          idempotencyKey: debitKey,
          metadata: {
            mode: validMode,
            sessionId: inputSessionId ?? null,
          },
          createdBy: talentId,
        });
      } else {
        const actionCode = validMode === COPILOT_MODES.STUDY
          ? 'TALENT_ASSISTANT_STUDY_QUERY'
          : 'TALENT_ASSISTANT_EXPLORER_QUERY';

        await debitWalletForAction({
          scope: 'TALENT',
          ownerId: talentId,
          actionCode,
          idempotencyKey: debitKey,
          metadata: {
            mode: validMode,
            sessionId: inputSessionId ?? null,
          },
          createdBy: talentId,
        });
      }
    } catch (debitError: any) {
      if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          error: req.t('billing:insufficientCredits'),
          code: 'INSUFFICIENT_CREDITS',
        });
      }
      throw debitError;
    }

    // Initialize SSE
    initSSE(res);

    // --- PHASE 1: Session + Context + Language in parallel ---
    const isOrg = !!organizationId;
    const contextOptions = isOrg
      ? ORG_CONTEXT_OPTIONS
      : validMode === COPILOT_MODES.STUDY
        ? STUDY_CONTEXT_OPTIONS
        : EXPLORER_CONTEXT_OPTIONS;

    // Cache key: ctx:{talentId}:{mode} — TTL 5 min, invalidated on profile/skills/docs mutation
    const ctxCacheKey = `ctx:${talentId}:${isOrg ? 'org' : validMode}`;

    const [session, talentContext, userLanguage] = await Promise.all([
      // Session (create or get — scoped by organizationId for isolation)
      (async () => {
        if (inputSessionId) {
          const existing = await copilotService.getSession(inputSessionId, talentId, organizationId);
          if (existing) return existing;
        }
        return copilotService.createSession(talentId, validMode, organizationId);
      })(),
      // Context loading (cached 5 min per talent+mode)
      cache.getOrSet(ctxCacheKey, () => loadTalentContext(talentId, contextOptions), 5 * 60 * 1000),
      // Language preference
      resolveTalentLanguage({ talentId, userId: req.userId, acceptLanguageHeader: req.headers['accept-language'] }),
    ]);
    const sessionId = session.id;
    const sessionContext: Record<string, unknown> =
      session.context && typeof session.context === 'object'
        ? { ...(session.context as Record<string, unknown>) }
        : {};

    let deterministicQuizHint: string | undefined;

    // Deterministic study quiz evaluation:
    // - Track active quiz in session context
    // - Evaluate A/B/C/D or option-text answers strictly
    // - Inject explicit state to prevent cross-question drift
    if (validMode === COPILOT_MODES.STUDY && safeMessage.length > 0 && !hasAttachments && !hasVoiceNote) {
      try {
        const studyQuizState = (sessionContext.studyQuiz && typeof sessionContext.studyQuiz === 'object')
          ? (sessionContext.studyQuiz as Record<string, unknown>)
          : {};

        let activeQuiz: ActiveQuizState | null = null;
        const candidateActive = studyQuizState.activeQuiz as ActiveQuizState | undefined;
        if (candidateActive && candidateActive.awaitingAnswer && Array.isArray(candidateActive.options)) {
          activeQuiz = candidateActive;
        }

        const latestAssistant = await getLatestAssistantMessage(sessionId);
        if (!activeQuiz && latestAssistant) {
          const latestQuiz = extractLastQuizBlock(latestAssistant.content);
          if (latestQuiz) {
            activeQuiz = {
              quizId: buildQuizId(latestQuiz),
              topic: latestQuiz.topic,
              question: latestQuiz.question,
              options: latestQuiz.options,
              correctAnswer: latestQuiz.correctAnswer,
              explanation: latestQuiz.explanation,
              sourceMessageId: latestAssistant.id,
              sourceMessageAt: new Date(latestAssistant.createdAt).toISOString(),
              awaitingAnswer: true,
            };
          }
        }

        if (activeQuiz) {
          const selectedIndex = parseQuizAnswer(safeMessage, activeQuiz.options);
          if (selectedIndex !== null) {
            const evaluation: QuizEvaluation = {
              selectedIndex,
              selectedOption: activeQuiz.options[selectedIndex],
              isCorrect: selectedIndex === activeQuiz.correctAnswer,
            };
            deterministicQuizHint = buildStudyQuizHint({ activeQuiz, evaluation });

            activeQuiz.awaitingAnswer = false;
            sessionContext.studyQuiz = {
              ...studyQuizState,
              activeQuiz,
              lastEvaluation: {
                quizId: activeQuiz.quizId,
                question: activeQuiz.question,
                userRawAnswer: safeMessage,
                selectedIndex: evaluation.selectedIndex,
                selectedOption: evaluation.selectedOption,
                correctIndex: activeQuiz.correctAnswer,
                isCorrect: evaluation.isCorrect,
                evaluatedAt: new Date().toISOString(),
              },
            };
            await persistSessionContext(sessionId, sessionContext);
          } else if (!studyQuizState.activeQuiz) {
            // Persist discovered active quiz even before first answer parse
            sessionContext.studyQuiz = {
              ...studyQuizState,
              activeQuiz,
            };
            await persistSessionContext(sessionId, sessionContext);
          }
        }
      } catch (quizErr: any) {
        logger.warn('[copilot] Failed deterministic quiz evaluation:', quizErr);
      }
    }

    // Detect active skill from user message triggers (CPU only, instant)
    const skillMode = isOrg ? 'org' : validMode;
    const userCountry = talentContext.profile?.country;
    const detectedSkill = await detectSkillFromMessage(safeMessage, skillMode as 'explore' | 'study' | 'org', userCountry);
    // Build active skill instructions with DPO few-shot examples
    let activeSkillInstructions: string | undefined;
    if (detectedSkill) {
      const trajectories = await getWinningTrajectories(detectedSkill.skillId).catch(() => '');
      activeSkillInstructions = `\n<active_skill_instructions skill="${detectedSkill.skillId}" name="${detectedSkill.skillName}">\n${detectedSkill.instructions}\n</active_skill_instructions>\n`;
      if (trajectories) {
        activeSkillInstructions += `\n${trajectories}\n`;
      }
    }

    // Conditional UEMOA knowledge injection (~2500 tokens saved when not relevant)
    const injectUEMOA = isUEMOACountry(userCountry) && shouldInjectUEMOA(safeMessage, detectedSkill?.skillId);

    // Build agent context (CPU only, instant)
    let agent: any;

    if (isOrg) {
      const orgInfo = talentContext.organizations?.organizations?.find(
        (o: any) => o.organizationId === organizationId
      );

      // Pre-load org stats (logo, city, country, member_count, sectors) — avoids org_stats tool calls
      let logoUrl: string | undefined;
      let orgCity: string | undefined;
      let orgCountry: string | undefined;
      let memberCount: number | undefined;
      let orgSectors: string[] | undefined;
      try {
        const orgStatsResult = await pool.query(
          `SELECT o.logo_url, o.headquarters_city, o.headquarters_country, o.sectors,
                  (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'ACTIVE') as member_count
           FROM organizations o WHERE o.id = $1`,
          [organizationId]
        );
        if (orgStatsResult.rows.length > 0) {
          const row = orgStatsResult.rows[0];
          logoUrl = row.logo_url || undefined;
          orgCity = row.headquarters_city || undefined;
          orgCountry = row.headquarters_country || undefined;
          memberCount = parseInt(row.member_count) || 0;
          orgSectors = row.sectors?.length ? row.sectors : undefined;
        }
      } catch (err: any) {
        logger.warn('[copilot] Failed to pre-load org stats', err);
      }

      const orgCtx: OrgContext = {
        talentId,
        talentName: `${talentContext.profile.firstName} ${talentContext.profile.lastName}`,
        organizationId,
        organizationName: orgInfo?.organizationName || 'Organisation',
        role: orgInfo?.role || 'MEMBER',
        language: userLanguage,
        country: talentContext.profile.country,
        orgSectors,
        memberCount,
        logoUrl,
        orgCity,
        orgCountry,
        activeSkillInstructions,
        injectUEMOA,
      };
      agent = createOrgAgent(orgCtx);
    } else {
      const talentCtx: TalentContext = {
        ...talentContext,
        talentId,
        talentName: `${talentContext.profile.firstName || ''} ${talentContext.profile.lastName || ''}`.trim() || talentContext.profile.email,
        language: userLanguage,
        activeSkillInstructions,
        injectUEMOA,
        session: {
          currentMode: session.mode === COPILOT_MODES.STUDY ? COPILOT_MODES.STUDY : COPILOT_MODES.EXPLORE,
          conversationTopic: session.title,
        },
      };
      agent = createTalentAgent(talentCtx);
    }

    // If replacing a previous exchange (edit & resend), soft-delete the last user message + its assistant response
    if (replaceLastExchange) {
      const lastUserMsg = await pool.query(
        `SELECT created_at FROM copilot_messages
         WHERE session_id = $1 AND role = 'user' AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [sessionId]
      );
      if (lastUserMsg.rows.length > 0) {
        await pool.query(
          `UPDATE copilot_messages SET deleted_at = CURRENT_TIMESTAMP
           WHERE session_id = $1 AND created_at >= $2 AND deleted_at IS NULL`,
          [sessionId, lastUserMsg.rows[0].created_at]
        );
      }
    }

    // Save user message FIRST (needed in history) — include talent_id for sender tracking
    // Include voiceNoteUrl in attachments at INSERT time (not a separate UPDATE) for reliable persistence
    const initialAttachments = voiceNoteUrl
      ? sanitizeJsonForPg({ voiceNoteUrl, voiceNoteMimeType })
      : sanitizeJsonForPg(null);
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content, attachments, talent_id) VALUES ($1, 'user', $2, $3, $4)`,
      [sessionId, sanitizeForPg(safeMessage), initialAttachments, talentId]
    );

    // --- PHASE 2: Attachments + Load history in parallel ---
    const [messageAttachments, historyRes] = await Promise.all([
      // Attachments (optional)
      (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0)
        ? pool.query(
            `SELECT id, original_filename as name, file_url as url, mime_type as type, file_size as size
             FROM talent_documents WHERE id = ANY($1) AND talent_id = $2`,
            [attachmentIds, talentId]
          ).then(r => JSON.stringify(r.rows))
        : Promise.resolve(null as string | null),
      // Load history (includes the user message we just saved, excludes soft-deleted)
      pool.query(
        `SELECT role, content FROM copilot_messages
         WHERE session_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 20`,
        [sessionId]
      ),
    ]);

    // Update user message with file attachments if present (merge with existing voiceNote data)
    if (messageAttachments) {
      const mergedAttachments = voiceNoteUrl
        ? JSON.stringify({ voiceNoteUrl, voiceNoteMimeType, files: JSON.parse(messageAttachments) })
        : messageAttachments;
      pool.query(
        `UPDATE copilot_messages SET attachments = $1
         WHERE id = (SELECT id FROM copilot_messages WHERE session_id = $2 AND role = 'user' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1)`,
        [sanitizeJsonForPg(mergedAttachments), sessionId]
      ).catch(() => {});
    }

    // Exclude the user message we just added (last one), then summarize if needed
    const rawHistory = historyRes.rows.slice(0, -1).map((r: any) => ({
      role: r.role,
      content: r.content,
    }));
    const [summarizedHistory, crossSessionMemory] = await Promise.all([
      summarizeHistoryIfNeeded(rawHistory, userLanguage),
      loadCrossSessionMemory({
        talentId,
        organizationId,
        currentSessionId: sessionId,
        mode: validMode,
        message: safeMessage,
        language: userLanguage,
      }).catch(() => []),
    ]);
    const history = crossSessionMemory.length > 0
      ? [...crossSessionMemory, ...summarizedHistory]
      : summarizedHistory;

    // --- Default agent message: infer intent from attachments if text is empty ---
    let agentMessage = safeMessage || (hasAttachments ? i18next.t('copilot:attachmentInferMessage') : '');
    let voiceNoteAnalysis: string | undefined;
    if (voiceNoteUrl && voiceNoteMimeType) {
      try {
        const { getFileBuffer } = await import('../services/storage.service');
        const audioBuffer = await getFileBuffer(voiceNoteUrl);
        const audioBase64 = audioBuffer.toString('base64');
        const audioMode = validMode === COPILOT_MODES.STUDY ? 'study' : (validMode === COPILOT_MODES.ORG ? 'org' : 'explore');
        voiceNoteAnalysis = await analyzeAudio(audioBase64, voiceNoteMimeType, audioMode as 'study' | 'explore' | 'org');
        agentMessage = buildStoredUserMessage(safeMessage, voiceNoteAnalysis);
        await pool.query(
          `UPDATE copilot_messages
           SET content = $1
           WHERE id = (
             SELECT id
             FROM copilot_messages
             WHERE session_id = $2 AND role = 'user' AND deleted_at IS NULL
             ORDER BY created_at DESC, id DESC
             LIMIT 1
           )`,
          [sanitizeForPg(agentMessage), sessionId]
        );
      } catch (audioErr: any) {
        logger.error('[copilot] Voice note analysis failed:', audioErr);
        // Fallback: send original message text
      }
    }

    if (deterministicQuizHint) {
      agentMessage = `${deterministicQuizHint}\n\nUser message:\n${agentMessage}`;
    }

    const latestAssistantBeforeCurrent = !hasVoiceNote && !hasAttachments && safeMessage
      ? await getLatestAssistantMessage(sessionId)
      : null;
    const confirmationToReplay =
      latestAssistantBeforeCurrent && userReportsMissingConfirmationBlock(safeMessage)
        ? extractLastConfirmationBlock(latestAssistantBeforeCurrent.content || '')
        : null;

    if (confirmationToReplay) {
      const finalOutput = buildConfirmationReplayResponse(confirmationToReplay, userLanguage);

      const insertAssistantResult = await pool.query(
        `INSERT INTO copilot_messages (session_id, role, content, tool_calls, output_data)
         VALUES ($1, 'assistant', $2, $3, $4)
         RETURNING id`,
        [sessionId, sanitizeForPg(finalOutput), null, null]
      );
      const assistantMessageId = insertAssistantResult.rows[0]?.id || null;

      pool.query(
        `INSERT INTO copilot_traces
          (session_id, message_id, talent_id, organization_id, mode, skill_id,
           turn_count, tool_count, tool_names, tool_errors, duration_ms, output_chars,
           has_tool_error, hit_loop_detection, hit_turn_limit, guardrail_blocked,
           input_tokens, output_tokens, cache_read_tokens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          sessionId,
          assistantMessageId,
          talentId,
          organizationId || null,
          validMode,
          detectedSkill?.skillId || null,
          0,
          0,
          [],
          0,
          0,
          finalOutput.length,
          false,
          false,
          false,
          false,
          0,
          0,
          0,
        ]
      ).catch((err) => logger.error('[copilot] Failed to persist replay trace:', err));

      const messageCount = historyRes.rows.length;
      if (messageCount <= 2) {
        const deterministicTitle = buildDeterministicSessionTitle(safeMessage, userLanguage, hasAttachments);
        const titlePromise = deterministicTitle
          ? Promise.resolve(deterministicTitle)
          : generateSessionTitle(safeMessage, userLanguage);

        titlePromise.then((title) => {
          copilotService.updateSessionTitle(sessionId, title).catch(() => { });
        });
      }

      sendSSE(res, { type: 'text_delta', delta: finalOutput });
      sendSSE(res, { type: 'content_corrected', content: finalOutput });
      sendSSE(res, { type: 'done', sessionId });
      res.end();
      return;
    }

    // Run agent with SSE streaming (pass attachments so agent sees file context)
    const parsedAttachments = messageAttachments ? JSON.parse(messageAttachments) : undefined;
    const { finalOutput: rawFinalOutput, toolTrace, segments, traceMetrics } = await runAgentWithSSE(
      agent,
      agentMessage,
      history,
      res,
      parsedAttachments
    );
    const finalOutput = normalizeConfirmationBlocks(rawFinalOutput, safeMessage);

    // --- TTS generation (agent-driven, study mode only) ---
    // The agent embeds ```audio_tts\n{"text":"...","instructions":"..."}\n``` blocks
    // when it wants to produce complementary audio (pronunciation, correction, vocal expression).
    // We extract these, generate TTS, and emit audio_ready SSE events.
    const audioSegments: Array<{ type: 'audio'; audioUrl: string; audioDuration: number }> = [];
    if (validMode === COPILOT_MODES.STUDY) {
      const ttsBlockRegex = /```audio_tts\n([\s\S]*?)```/g;
      let ttsMatch: RegExpExecArray | null;
      while ((ttsMatch = ttsBlockRegex.exec(finalOutput)) !== null) {
        try {
          const raw = ttsMatch[1].trim();
          const ttsData = JSON.parse(raw);
          const ttsText = (ttsData.text || '').trim();
          if (!ttsText || ttsText.length < 5) continue;
          const ttsInstructions = ttsData.instructions || undefined; // Falls back to DEFAULT_INSTRUCTIONS in tts.service.ts
          const ttsVoice = ttsData.voice || 'coral';
          const ttsBuffer = await generateTTS(ttsText, ttsVoice, ttsInstructions);
          const audioPath = `copilot/tts/${sessionId}/${Date.now()}.mp3`;
          const audioUrl = await uploadFile(ttsBuffer, audioPath, 'audio/mpeg');
          const estimatedDuration = Math.ceil(ttsText.split(/\s+/).length / 2.5);
          audioSegments.push({ type: 'audio', audioUrl, audioDuration: estimatedDuration });
          sendSSE(res, { type: 'audio_ready', audioUrl, duration: estimatedDuration });
        } catch (ttsErr: any) {
          logger.error('[copilot] TTS block generation failed:', ttsErr);
        }
      }
    }

    // Save assistant response (persist segments in output_data for reload)
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content, tool_calls, output_data)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [
        sessionId,
        sanitizeForPg(finalOutput),
        toolTrace.length > 0 ? sanitizeJsonForPg(toolTrace) : null,
        segments.length > 0 || audioSegments.length > 0
          ? sanitizeJsonForPg([...segments, ...audioSegments])
          : null,
      ]
    );

    // Persist active study quiz block for deterministic next-turn evaluation
    if (validMode === COPILOT_MODES.STUDY) {
      try {
        const latestQuiz = extractLastQuizBlock(finalOutput);
        if (latestQuiz) {
          const assistantMsgResult = await pool.query(
            `SELECT id, created_at
             FROM copilot_messages
             WHERE session_id = $1 AND role = 'assistant' AND deleted_at IS NULL
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [sessionId]
          );
          const assistantMessageId = assistantMsgResult.rows[0]?.id;
          const assistantCreatedAt = assistantMsgResult.rows[0]?.created_at;
          const studyQuizState = (sessionContext.studyQuiz && typeof sessionContext.studyQuiz === 'object')
            ? (sessionContext.studyQuiz as Record<string, unknown>)
            : {};

          const nextActive: ActiveQuizState = {
            quizId: buildQuizId(latestQuiz),
            topic: latestQuiz.topic,
            question: latestQuiz.question,
            options: latestQuiz.options,
            correctAnswer: latestQuiz.correctAnswer,
            explanation: latestQuiz.explanation,
            sourceMessageId: assistantMessageId,
            sourceMessageAt: assistantCreatedAt ? new Date(assistantCreatedAt).toISOString() : new Date().toISOString(),
            awaitingAnswer: true,
          };

          sessionContext.studyQuiz = {
            ...studyQuizState,
            activeQuiz: nextActive,
            updatedAt: new Date().toISOString(),
          };
          await persistSessionContext(sessionId, sessionContext);
        }
      } catch (quizPersistErr: any) {
        logger.warn('[copilot] Failed to persist study quiz context:', quizPersistErr);
      }
    }

    // Persist copilot trace (DPO analytics — non-blocking)
    const assistantMsgResult = await pool.query(
      `SELECT id FROM copilot_messages WHERE session_id = $1 AND role = 'assistant' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );
    const assistantMessageId = assistantMsgResult.rows[0]?.id || null;
    pool.query(
      `INSERT INTO copilot_traces
        (session_id, message_id, talent_id, organization_id, mode, skill_id,
         turn_count, tool_count, tool_names, tool_errors, duration_ms, output_chars,
         has_tool_error, hit_loop_detection, hit_turn_limit, guardrail_blocked,
         input_tokens, output_tokens, cache_read_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        sessionId,
        assistantMessageId,
        talentId,
        organizationId || null,
        validMode,
        detectedSkill?.skillId || null,
        traceMetrics.turnCount,
        traceMetrics.toolCount,
        traceMetrics.toolNames,
        traceMetrics.toolErrors,
        traceMetrics.durationMs,
        traceMetrics.outputChars,
        traceMetrics.hasToolError,
        traceMetrics.hitLoopDetection,
        traceMetrics.hitTurnLimit,
        traceMetrics.guardrailBlocked,
        traceMetrics.inputTokens,
        traceMetrics.outputTokens,
        traceMetrics.cacheReadTokens,
      ]
    ).catch((err) => logger.error('[copilot] Failed to persist trace:', err));

    // Generate title for first message (non-blocking)
    const messageCount = historyRes.rows.length;
    if (messageCount <= 2) {
      const deterministicTitle = buildDeterministicSessionTitle(safeMessage, userLanguage, hasAttachments);
      const titlePromise = deterministicTitle
        ? Promise.resolve(deterministicTitle)
        : generateSessionTitle(safeMessage, userLanguage);

      titlePromise.then((title) => {
        copilotService.updateSessionTitle(sessionId, title).catch(() => { });
      });
    }

    // Send authoritative final content before done to avoid SSE delta assembly drift on clients
    sendSSE(res, { type: 'content_corrected', content: finalOutput });

    // Send done event
    sendSSE(res, { type: 'done', sessionId });
    res.end();
  } catch (error: any) {
    logger.error('Error in copilot chat:', error);
    // If headers already sent (SSE started), send error event
    if (res.headersSent) {
      sendSSE(res, { type: 'error', error: req.t('copilot:processingError') });
      res.end();
    } else {
      res.status(500).json({ error: req.t('copilot:processingError') });
    }
  }
});

/**
 * GET /api/copilot/suggestions - Get AI-powered intent suggestions
 * Query: { mode?: string, sessionId?: string }
 * Returns: { suggestions: string[] }
 */

// Simple in-memory cache for suggestions to boost speed
interface CacheEntry {
  suggestions: string[];
  timestamp: number;
}
const suggestionsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

router.get('/suggestions', copilotGeneralLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const mode = (req.query.mode as string) || 'explore';
    const sessionId = req.query.sessionId as string | undefined;
    const organizationId = req.query.organizationId as string | undefined;

    // 1. Check cache FIRST — before any DB/AI calls
    const cacheKey = `${talentId}:${sessionId || 'new'}:${mode}:${organizationId || 'personal'}`;
    const cached = suggestionsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.json({
        success: true,
        data: { suggestions: cached.suggestions }
      });
    }

    const userLanguage = await resolveTalentLanguage({ talentId, userId: req.userId, acceptLanguageHeader: req.headers['accept-language'] });
    const languageName = getLanguageDisplayName(userLanguage);

    // 2. Cache miss — lightweight parallel data fetch (NO loadTalentContext)
    const { pool: dbPool } = await import('../services/database');

    const [historyRows, profileRow] = await Promise.all([
      sessionId
        ? dbPool.query(
            `SELECT role, content FROM copilot_messages
             WHERE session_id = $1 ORDER BY created_at DESC LIMIT 4`,
            [sessionId]
          ).then(r => r.rows.reverse()).catch(() => [])
        : Promise.resolve([]),
      dbPool.query(
        `SELECT first_name, goals, sectors FROM talents WHERE id = $1`,
        [talentId]
      ).then(r => r.rows[0]).catch(() => null)
    ]);

    const talentContext = profileRow ? {
      firstName: profileRow.first_name,
      goals: profileRow.goals,
      sectors: profileRow.sectors,
    } : undefined;

    // 3. Generate suggestions (OpenAI)
    const { Runner } = await import('@openai/agents');
    const { createIntentSuggestionsAgent } = await import('../services/ai/agent-factory');
    const { buildIntentSuggestionsPrompt } = await import('../services/ai/prompts/session-utils.prompt');
    const { openaiProvider } = await import('../services/ai/provider');

    const systemPrompt = buildIntentSuggestionsPrompt(mode, historyRows, talentContext, languageName);
    const agent = createIntentSuggestionsAgent(systemPrompt);
    const suggestionRunner = new Runner({ modelProvider: openaiProvider });

    let suggestions: string[] = [];
    try {
      const result = await suggestionRunner.run(agent, `Generate 4 suggestions in ${languageName}.`);
      const text = result.finalOutput?.trim() || '[]';
      suggestions = JSON.parse(text);

      if (!Array.isArray(suggestions) || suggestions.length < 4) {
        throw new Error('Invalid format');
      }
      suggestions = suggestions.slice(0, 4);

      // Update cache
      suggestionsCache.set(cacheKey, { suggestions, timestamp: Date.now() });
    } catch {
      suggestions = mode === 'study'
        ? req.t('copilot:suggestionsStudyFallback', { returnObjects: true }) as string[]
        : req.t('copilot:suggestionsExploreFallback', { returnObjects: true }) as string[];
    }

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    logger.error('Error in suggestions:', error);
    res.json({
      success: true,
      data: {
        suggestions: req.t('copilot:suggestionsExploreFallback', { returnObjects: true }) as string[],
      },
    });
  }
});

// --- Message Feedback (DPO Signal) ---

/**
 * PATCH /api/copilot/messages/:messageId/feedback - Rate a copilot response
 * Body: { rating: 1 | 3 }  // 1 = thumbs down, 3 = thumbs up
 * Returns: { success: boolean }
 */
router.patch('/messages/:messageId/feedback', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { messageId } = req.params;
    const { rating } = req.body;

    // Validate messageId is a valid UUID before querying
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID format' });
    }

    if (rating !== 1 && rating !== 3) {
      return res.status(400).json({ error: req.t('copilot:feedbackRatingInvalid') });
    }

    // Verify the message belongs to the user's session
    const msgCheck = await pool.query(
      `SELECT cm.id, cs.talent_id, cs.organization_id
       FROM copilot_messages cm
       JOIN copilot_sessions cs ON cs.id = cm.session_id
       WHERE cm.id = $1 AND cm.role = 'assistant' AND cm.deleted_at IS NULL`,
      [messageId]
    );

    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ error: req.t('copilot:feedbackMessageNotFound') });
    }

    const msg = msgCheck.rows[0];
    // Allow if user owns the session OR is a member of the org
    if (msg.talent_id !== talentId && msg.organization_id) {
      const orgMember = await pool.query(
        `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND status = 'ACTIVE' LIMIT 1`,
        [msg.organization_id, talentId]
      );
      if (orgMember.rows.length === 0) {
        return res.status(403).json({ error: req.t('copilot:feedbackAccessDenied') });
      }
    } else if (msg.talent_id !== talentId) {
      return res.status(403).json({ error: req.t('copilot:feedbackAccessDenied') });
    }

    // Update the trace with user rating
    const result = await pool.query(
      `UPDATE copilot_traces SET user_rating = $1 WHERE message_id = $2 RETURNING id, skill_id`,
      [rating, messageId]
    );

    // Invalidate trajectory cache for this skill so new ratings take effect
    if (result.rows[0]?.skill_id) {
      invalidateTrajectoryCache(result.rows[0].skill_id);
    }

    if (result.rows.length === 0) {
      // Trace may not exist yet (race condition or old message) — create a minimal one
      await pool.query(
        `INSERT INTO copilot_traces (session_id, message_id, talent_id, organization_id, mode, user_rating, turn_count, tool_count, duration_ms, output_chars)
         SELECT cm.session_id, cm.id, cs.talent_id, cs.organization_id, cs.mode, $1, 0, 0, 0, length(cm.content)
         FROM copilot_messages cm
         JOIN copilot_sessions cs ON cs.id = cm.session_id
         WHERE cm.id = $2
         ON CONFLICT DO NOTHING`,
        [rating, messageId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error saving feedback:', error);
    res.status(500).json({ error: req.t('copilot:feedbackSaveFailed') });
  }
});

// --- Action Confirmation ---

/**
 * POST /api/copilot/confirm - Execute a confirmed action
 * Body: { action: string, entityId: string, sessionId?: string, data?: object }
 * Returns: { success: boolean, message: string, data?: object }
 */
router.post('/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { action, entityId, sessionId, data } = req.body;

    if (!action || !entityId) {
      return res.status(400).json({ error: req.t('copilot:confirmActionEntityRequired') });
    }

    const language = await resolveTalentLanguage({ talentId, userId: req.userId, acceptLanguageHeader: req.headers['accept-language'] });
    const result = await handleConfirmation(talentId, { action, entityId, sessionId, data }, language);

    res.json({
      success: result.success,
      data: {
        message: result.message,
        ...result.data,
      },
    });
  } catch (error) {
    logger.error('Error in copilot confirm:', error);
    res.status(500).json({ error: req.t('copilot:processingError') });
  }
});

// --- Voice Note Upload ---

const voiceNoteUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max (30s audio)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(((req as any).t || (() => `Unsupported audio type: ${file.mimetype}`))('copilot:audioTypeNotSupported', { mimetype: file.mimetype })));
    }
  },
});

/**
 * POST /api/copilot/voice-note - Upload a voice note for analysis
 * Body: FormData with 'audio' file field
 * Returns: { voiceNoteUrl: string, mimeType: string }
 */
router.post(
  '/voice-note',
  authMiddleware,
  voiceNoteUpload.single('audio'),
  async (req: AuthRequest, res: Response) => {
    try {
      const talentId = req.talentId;
      if (!talentId) {
        return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: req.t('copilot:noAudioFile') });
      }

      // Store the voice note — sanitize filename to prevent path traversal
      const safeName = (file.originalname || 'voice.m4a').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
      const storagePath = `copilot/voice-notes/${talentId}/${Date.now()}-${safeName}`;
      const fileUrl = await uploadFile(file.buffer, storagePath, file.mimetype);

      logger.info(`[copilot] Voice note uploaded for talent ${talentId}: ${fileUrl}`);

      res.json({
        success: true,
        data: {
          voiceNoteUrl: fileUrl,
          mimeType: file.mimetype,
        },
      });
    } catch (error: any) {
      logger.error('Error uploading voice note:', error);
      res.status(500).json({ error: req.t('copilot:voiceUploadError') });
    }
  }
);

// --- Audio Transcription Whisper Stt ---

const AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
] as const;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Whisper limit)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (AUDIO_MIME_TYPES.includes(file.mimetype as (typeof AUDIO_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(new Error(((req as any).t || (() => `Unsupported audio type: ${file.mimetype}`))('copilot:audioTypeNotSupportedFormats', { mimetype: file.mimetype })));
    }
  },
});

/**
 * POST /api/copilot/transcribe - Transcribe audio using OpenAI gpt-4o-mini-transcribe
 * Better WER and French language recognition than whisper-1.
 * Body: FormData with 'audio' file field
 * Returns: { text: string }
 */
router.post(
  '/transcribe',
  authMiddleware,
  audioUpload.single('audio'),
  async (req: AuthRequest, res: Response) => {
    try {
      const talentId = req.talentId;
      if (!talentId) {
        return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: req.t('copilot:noAudioFile') });
      }

      const { getOpenAIClient } = await import('../services/ai/provider');
      const openai = getOpenAIClient();

      // Create a File-like object from buffer for the API
      const audioFile = new File([file.buffer], file.originalname, {
        type: file.mimetype,
      });

      // gpt-4o-mini-transcribe: better accuracy, lower WER, better French support
      // response_format must be 'json' for gpt-4o-mini-transcribe (text not supported)
      const language = await resolveTalentLanguage({ talentId, userId: req.userId, acceptLanguageHeader: req.headers['accept-language'] });
      const result = await openai.audio.transcriptions.create({
        file: audioFile,
        model: MODEL_STT,
        language,
      });

      const transcription = typeof result === 'string' ? result : (result as any).text || '';

      logger.info(`Audio transcribed for talent ${talentId}: ${transcription.slice(0, 50)}...`);

      res.json({
        success: true,
        data: {
          text: transcription,
        },
      });
    } catch (error: any) {
      logger.error('Error transcribing audio:', error);

      // Handle specific OpenAI errors
      if (error?.status === 400) {
        return res.status(400).json({
          error: req.t('copilot:invalidAudioFormat'),
        });
      }

      res.status(500).json({
        error: req.t('copilot:transcriptionError'),
      });
    }
  }
);

// --- Attachment Upload Copilot File Attachments → Documents ---

const copilotUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES,
    files: DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(new Error(((req as any).t || (() => `File type not allowed: ${file.mimetype}`))('copilot:fileTypeNotAllowedFormats', { mimetype: file.mimetype })));
    }
  },
});

/**
 * POST /api/copilot/attachments - Upload files from copilot chat
 * Files are stored as documents and go through the auto-extraction flow.
 * If no skills are inferred from the document, no skills are attached.
 * Max 5 files per request, PDF/images only, 20MB max each.
 * Returns: { documents: TalentDocument[] }
 */
router.post(
  '/attachments',
  authMiddleware,
  copilotUpload.array('file', DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST),
  async (req: AuthRequest, res: Response) => {
    try {
      const talentId = req.talentId;
      if (!talentId) {
        return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: req.t('copilot:noFileProvided') });
      }

      if (files.length > DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST) {
        return res.status(400).json({
          error: req.t('documents:maxFilesPerRequest', { count: DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST }),
        });
      }

      // Check document limit
      const limitCheck = await canUploadDocument(talentId);
      if (!limitCheck.canUpload) {
        return res.status(400).json({
          error: limitCheck.error,
          currentCount: limitCheck.currentCount,
          maxCount: limitCheck.maxCount,
        });
      }

      if (limitCheck.currentCount + files.length > limitCheck.maxCount) {
        return res.status(400).json({
          error: req.t('documents:maxDocumentsExceeded', { remaining: limitCheck.maxCount - limitCheck.currentCount, max: limitCheck.maxCount }),
        });
      }

      const uploadedDocuments = [];
      const fileIdempotencyHeader = req.headers['x-idempotency-key'];
      const fileIdempotencyValue = Array.isArray(fileIdempotencyHeader)
        ? fileIdempotencyHeader[0]
        : fileIdempotencyHeader;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const validation = validateFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        if (!validation.valid) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
        }

        const fileDebitKey = fileIdempotencyValue
          ? `copilot_upload_${fileIdempotencyValue}_${index}`
          : `copilot_upload_${crypto.randomUUID()}`;

        try {
          await debitWalletForAction({
            scope: 'TALENT',
            ownerId: talentId,
            actionCode: 'TALENT_DOCUMENT_UPLOAD',
            idempotencyKey: fileDebitKey,
            metadata: {
              fileName: file.originalname,
              channel: 'copilot',
            },
            createdBy: talentId,
          });
        } catch (debitError: any) {
          if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
            return res.status(402).json({
              error: req.t('billing:insufficientCredits'),
              code: 'INSUFFICIENT_CREDITS',
            });
          }
          throw debitError;
        }

        // Upload as document — auto-extraction will classify and extract skills.
        // If the document doesn't match known categories, it falls into 'OTHER'.
        // Skills are only attached if the extraction finds relevant competencies.
        const document = await uploadDocument({
          talentId,
          file: {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
        });

        uploadedDocuments.push(document);
      }

      res.status(201).json({
        success: true,
        data: {
          documents: uploadedDocuments,
          message: uploadedDocuments.length === 1
            ? req.t('copilot:attachmentSuccess')
            : req.t('copilot:attachmentMultipleSuccess', { count: uploadedDocuments.length }),
        },
      });
    } catch (error) {
      logger.error('Error uploading copilot attachment:', error);
      res.status(500).json({
        error: req.t('copilot:uploadError'),
      });
    }
  }
);

// --- Session Management ---

/**
 * GET /api/copilot/sessions - List user's copilot sessions
 * Query: { limit?: number }
 * Returns: { sessions: Array<{ id, title, mode, lastMessageAt, createdAt, messageCount }> }
 */
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const organizationId = req.query.organizationId as string | undefined;

    const sessions = await copilotService.listSessions(talentId, limit, organizationId);

    res.json({
      success: true,
      data: { sessions },
    });
  } catch (error) {
    logger.error('Error listing copilot sessions:', error);
    res.status(500).json({
      error: req.t('copilot:sessionsError'),
    });
  }
});

/**
 * POST /api/copilot/sessions - Create a new session
 * Body: { mode: 'explore' | 'study' | 'org', organizationId?: string }
 * Returns: CopilotSession
 */
router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { mode, organizationId } = req.body;
    const validMode: CopilotMode = Object.values(COPILOT_MODES).includes(mode as CopilotMode)
      ? (mode as CopilotMode)
      : COPILOT_MODES.EXPLORE;

    if (validMode === COPILOT_MODES.ORG && !organizationId) {
      return res.status(400).json({ error: req.t('copilot:orgIdRequired') });
    }

    // Prevent creating org-scoped sessions for organizations where the caller is not an active member.
    if (validMode === COPILOT_MODES.ORG && organizationId) {
      const hasMembership = await isActiveOrganizationMember(organizationId, talentId);
      if (!hasMembership) {
        return res.status(403).json({ error: req.t('organizations:notMember') });
      }
    }

    const session = await copilotService.createSession(talentId, validMode, organizationId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error('Error creating copilot session:', error);
    res.status(500).json({
      error: req.t('copilot:sessionCreateError'),
    });
  }
});

/**
 * GET /api/copilot/sessions/:id - Get session details with messages
 * Returns: { session: CopilotSession, messages: CopilotMessage[] }
 */
router.get('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const sessionId = req.params.id;
    const organizationId = req.query.organizationId as string | undefined;

    const session = await copilotService.getSession(sessionId, talentId, organizationId);
    if (!session) {
      return res.status(404).json({ error: req.t('copilot:sessionNotFound') });
    }

    const messages = await copilotService.getSessionMessages(sessionId);

    res.json({
      success: true,
      data: { session, messages },
    });
  } catch (error) {
    logger.error('Error getting copilot session:', error);
    res.status(500).json({
      error: req.t('copilot:sessionFetchError'),
    });
  }
});

/**
 * DELETE /api/copilot/sessions/:id - Delete a session
 */
router.delete('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const sessionId = req.params.id;
    const organizationId = req.query.organizationId as string | undefined;

    const deleted = await copilotService.deleteSession(sessionId, talentId, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: req.t('copilot:sessionNotFound') });
    }

    res.json({
      success: true,
      message: req.t('copilot:sessionDeleted'),
    });
  } catch (error) {
    logger.error('Error deleting copilot session:', error);
    res.status(500).json({
      error: req.t('copilot:sessionDeleteError'),
    });
  }
});

/**
 * PATCH /api/copilot/sessions/:id - Update session (rename, pin/unpin)
 * Body: { title?: string, isPinned?: boolean }
 * Query: { organizationId?: string }
 * Returns: { session: CopilotSession }
 */
router.patch('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const sessionId = req.params.id;
    const organizationId = req.query.organizationId as string | undefined;
    const { title, isPinned } = req.body;

    // Validate at least one field is provided
    if (title === undefined && isPinned === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Validate title length
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 255)) {
      return res.status(400).json({ error: 'Title must be between 1 and 255 characters' });
    }

    const updates: { title?: string; isPinned?: boolean } = {};
    if (title !== undefined) updates.title = title.trim();
    if (isPinned !== undefined) updates.isPinned = !!isPinned;

    const session = await copilotService.updateSession(sessionId, talentId, updates, organizationId);
    if (!session) {
      return res.status(404).json({ error: req.t('copilot:sessionNotFound') });
    }

    res.json({
      success: true,
      data: { session },
    });
  } catch (error) {
    logger.error('Error updating copilot session:', error);
    res.status(500).json({
      error: req.t('copilot:sessionUpdateError'),
    });
  }
});

/**
 * GET /api/copilot/sessions/:id/messages - Get session messages
 * Query: { limit?: number }
 * Returns: { messages: CopilotMessage[] }
 */
router.get('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const sessionId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const organizationId = req.query.organizationId as string | undefined;

    // Verify session belongs to user (and org scope if applicable)
    const session = await copilotService.getSession(sessionId, talentId, organizationId);
    if (!session) {
      return res.status(404).json({ error: req.t('copilot:sessionNotFound') });
    }

    const messages = await copilotService.getSessionMessages(sessionId, limit);

    res.json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    logger.error('Error getting copilot messages:', error);
    res.status(500).json({
      error: req.t('copilot:messagesError'),
    });
  }
});


export default router;
