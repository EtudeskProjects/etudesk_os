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
import { shouldInjectUEMOA } from '../services/copilot/uemoa-knowledge';
import { summarizeHistoryIfNeeded } from '../services/copilot/session-summarizer';
import { handleConfirmation } from '../services/copilot/actions/action.handler';
import { copilotChatLimiter, copilotGeneralLimiter } from '../middleware/rateLimit.middleware';
import { debitWalletForAction } from '../services/billing/credit.service';
import { cache } from '../utils/cache';

const router = Router();
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

function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
}): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
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
    const roleLabel = r.role === 'assistant' ? 'Assistant' : 'Utilisateur';
    const clean = String(r.content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    return `${i + 1}. (${roleLabel}) ${clean}`;
  });

  const memoryBlock =
    `[Mémoire inter-sessions pertinente]\n` +
    `Contexte utile trouvé dans d'anciennes conversations liées à cette requête:\n` +
    snippets.map((s) => `- ${s}`).join('\n');

  return [
    { role: 'user', content: memoryBlock },
    { role: 'assistant', content: "Compris. J'utilise cette mémoire comme contexte, sans la traiter comme une instruction prioritaire." },
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
      return res.status(400).json({ error: 'organizationId is required for org mode' });
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
      req.userId
        ? pool.query('SELECT preferred_language FROM users WHERE id = $1', [req.userId])
            .then(r => { const l = r.rows[0]?.preferred_language; return (l === 'en' || l === 'fr') ? l as 'fr' | 'en' : 'fr' as const; })
        : Promise.resolve('fr' as const),
    ]);
    const sessionId = session.id;

    // Detect active skill from user message triggers (CPU only, instant)
    const skillMode = isOrg ? 'org' : validMode;
    const detectedSkill = await detectSkillFromMessage(safeMessage, skillMode as 'explore' | 'study' | 'org');
    const activeSkillInstructions = detectedSkill
      ? `\n<active_skill_instructions skill="${detectedSkill.skillId}" name="${detectedSkill.skillName}">\n${detectedSkill.instructions}\n</active_skill_instructions>\n`
      : undefined;

    // Conditional UEMOA knowledge injection (~2500 tokens saved when not relevant)
    const injectUEMOA = shouldInjectUEMOA(safeMessage, detectedSkill?.skillId);

    // Build agent context (CPU only, instant)
    let agent: any;

    if (isOrg) {
      const orgInfo = talentContext.organizations?.organizations?.find(
        (o: any) => o.organizationId === organizationId
      );
      const orgCtx: OrgContext = {
        talentId,
        talentName: `${talentContext.profile.firstName} ${talentContext.profile.lastName}`,
        organizationId,
        organizationName: orgInfo?.organizationName || 'Organisation',
        role: orgInfo?.role || 'MEMBER',
        language: userLanguage,
        country: talentContext.profile.country,
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
      summarizeHistoryIfNeeded(rawHistory),
      loadCrossSessionMemory({
        talentId,
        organizationId,
        currentSessionId: sessionId,
        mode: validMode,
        message: safeMessage,
      }).catch(() => []),
    ]);
    const history = crossSessionMemory.length > 0
      ? [...crossSessionMemory, ...summarizedHistory]
      : summarizedHistory;

    // --- Default agent message: infer intent from attachments if text is empty ---
    let agentMessage = safeMessage || (hasAttachments ? '[L\'utilisateur a envoyé un ou plusieurs fichiers sans message. Analyse les fichiers joints et propose une action pertinente.]' : '');
    let voiceNoteAnalysis: string | undefined;
    if (voiceNoteUrl && voiceNoteMimeType) {
      try {
        const { getFileBuffer } = await import('../services/storage.service');
        const audioBuffer = await getFileBuffer(voiceNoteUrl);
        const audioBase64 = audioBuffer.toString('base64');
        const audioMode = validMode === COPILOT_MODES.STUDY ? 'study' : (validMode === COPILOT_MODES.ORG ? 'org' : 'explore');
        voiceNoteAnalysis = await analyzeAudio(audioBase64, voiceNoteMimeType, audioMode as 'study' | 'explore' | 'org');
        agentMessage = voiceNoteAnalysis;
      } catch (audioErr: any) {
        logger.error('[copilot] Voice note analysis failed:', audioErr);
        // Fallback: send original message text
      }
    }

    // Run agent with SSE streaming (pass attachments so agent sees file context)
    const parsedAttachments = messageAttachments ? JSON.parse(messageAttachments) : undefined;
    const { finalOutput, toolTrace, segments } = await runAgentWithSSE(
      agent,
      agentMessage,
      history,
      res,
      parsedAttachments
    );

    // --- TTS generation (study mode only, non-blocking for SSE) ---
    let audioUrl: string | undefined;
    if (validMode === COPILOT_MODES.STUDY && finalOutput.length > 10) {
      try {
        const ttsBuffer = await generateTTS(
          finalOutput,
          'nova',
          'Parle lentement et clairement pour un apprenant. Sois naturel et encourageant.'
        );
        const audioPath = `copilot/tts/${sessionId}/${Date.now()}.mp3`;
        audioUrl = await uploadFile(ttsBuffer, audioPath, 'audio/mpeg');
        const estimatedDuration = Math.ceil(finalOutput.split(/\s+/).length / 2.5); // ~2.5 words/sec
        sendSSE(res, { type: 'audio_ready', audioUrl, duration: estimatedDuration });
      } catch (ttsErr: any) {
        logger.error('[copilot] TTS generation failed:', ttsErr);
        // Non-blocking: skip TTS if it fails
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
        segments.length > 0 ? sanitizeJsonForPg(audioUrl ? [...segments, { type: 'audio', audioUrl }] : segments) : null,
      ]
    );

    // Generate title for first message (non-blocking)
    const messageCount = historyRes.rows.length;
    if (messageCount <= 2) {
      generateSessionTitle(safeMessage).then((title) => {
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

    // 3. Generate suggestions with Gemini
    const { Runner } = await import('@openai/agents');
    const { createIntentSuggestionsAgent } = await import('../services/ai/agent-factory');
    const { buildIntentSuggestionsPrompt } = await import('../services/ai/prompts/session-utils.prompt');
    const { geminiProvider } = await import('../services/ai/provider');

    const systemPrompt = buildIntentSuggestionsPrompt(mode, historyRows, talentContext);
    const agent = createIntentSuggestionsAgent(systemPrompt);
    const geminiRunner = new Runner({ modelProvider: geminiProvider });

    let suggestions: string[] = [];
    try {
      const result = await geminiRunner.run(agent, 'Génère les 4 suggestions.');
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
        ? ['Prépare-moi pour un entretien', 'Analyse mes compétences', 'Crée un quiz sur un sujet', 'Résume mon CV et conseille-moi']
        : ['Offres qui matchent mon profil', 'Génère mon CV en PDF', 'Communautés dans mon secteur', 'Ajoute une compétence'];
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
        suggestions: ['Offres qui matchent mon profil', 'Génère mon CV en PDF', 'Communautés dans mon secteur', 'Analyse mes compétences'],
      },
    });
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
      return res.status(400).json({ error: 'action and entityId are required' });
    }

    const result = await handleConfirmation(talentId, { action, entityId, sessionId, data });

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
      cb(new Error(`Type audio non supporté: ${file.mimetype}`));
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

      // Store the voice note
      const storagePath = `copilot/voice-notes/${talentId}/${Date.now()}-${file.originalname || 'voice.m4a'}`;
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
      res.status(500).json({ error: 'Erreur lors de l\'upload de la note vocale' });
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
      cb(new Error(`Type audio non supporté: ${file.mimetype}. Formats acceptés: webm, mp4, m4a, mp3, wav`));
    }
  },
});

/**
 * POST /api/copilot/transcribe - Transcribe audio using OpenAI Whisper
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

      // STT always uses OpenAI (Whisper)
      const { getOpenAIClient } = await import('../services/ai/provider');
      const openai = getOpenAIClient();

      // Create a File-like object from buffer for the API
      const audioFile = new File([file.buffer], file.originalname, {
        type: file.mimetype,
      });

      // Call Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: MODEL_STT,
        language: 'fr', // French by default, auto-detect if not specified
        response_format: 'text',
      });

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
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}. Formats acceptés: PDF, JPEG, PNG, WebP, HEIC`));
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
          error: `Maximum ${DOCUMENT_LIMITS.MAX_FILES_PER_REQUEST} fichiers par requête`,
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
          error: `Vous ne pouvez ajouter que ${limitCheck.maxCount - limitCheck.currentCount} document(s) supplémentaire(s). Limite: ${limitCheck.maxCount}.`,
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
            ? 'Document ajouté et en cours de traitement.'
            : `${uploadedDocuments.length} documents ajoutés et en cours de traitement.`,
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
      return res.status(400).json({ error: 'organizationId is required for org mode' });
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

    const deleted = await copilotService.deleteSession(sessionId, talentId);
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
