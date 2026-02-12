/**
 * Copilot API Routes
 * Routes for AI copilot chat and session management
 * OpenAI Agents SDK + GPT-5 + SSE Streaming
 */

import { Router, Response } from 'express';
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
import { summarizeHistoryIfNeeded } from '../services/copilot/session-summarizer';
import { handleConfirmation } from '../services/copilot/actions/action.handler';
import { copilotChatLimiter, copilotGeneralLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/** Sanitize strings before PostgreSQL insertion — removes null bytes and fixes broken Unicode escapes */
function sanitizeForPg(value: string | null | undefined): string | null {
  if (!value) return value as null;
  // Remove \u0000 null bytes (PostgreSQL rejects them)
  return value.replace(/\u0000/g, '').replace(/\\u0000/g, '');
}
function sanitizeJsonForPg(value: any): string | null {
  if (!value) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return sanitizeForPg(str);
}

// --- Chat Endpoint — Sse Streaming ---

/**
 * POST /api/copilot/chat - Send a message to the copilot (SSE streaming)
 * Body: { sessionId?: string, message: string, mode?: 'explore' | 'study', organizationId?: string }
 * Response: Server-Sent Events stream
 */
router.post('/chat', copilotChatLimiter, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { sessionId: inputSessionId, message, mode, organizationId, attachmentIds } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: req.t('copilot:messageRequired') });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: req.t('copilot:messageTooLong') });
    }

    // Validate mode
    const validMode: CopilotMode = Object.values(COPILOT_MODES).includes(mode as CopilotMode)
      ? (mode as CopilotMode)
      : COPILOT_MODES.EXPLORE;

    // Initialize SSE
    initSSE(res);

    // --- PHASE 1: Session + Context + Language in parallel ---
    const isOrg = !!organizationId;
    const contextOptions = isOrg
      ? ORG_CONTEXT_OPTIONS
      : validMode === COPILOT_MODES.STUDY
        ? STUDY_CONTEXT_OPTIONS
        : EXPLORER_CONTEXT_OPTIONS;

    const [session, talentContext, userLanguage] = await Promise.all([
      // Session (create or get)
      (async () => {
        if (inputSessionId) {
          const existing = await copilotService.getSession(inputSessionId, talentId);
          if (existing) return existing;
        }
        return copilotService.createSession(talentId, validMode);
      })(),
      // Context loading
      loadTalentContext(talentId, contextOptions),
      // Language preference
      req.userId
        ? pool.query('SELECT preferred_language FROM users WHERE id = $1', [req.userId])
            .then(r => { const l = r.rows[0]?.preferred_language; return (l === 'en' || l === 'fr') ? l as 'fr' | 'en' : 'fr' as const; })
        : Promise.resolve('fr' as const),
    ]);
    const sessionId = session.id;

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
      };
      agent = createOrgAgent(orgCtx);
    } else {
      const talentCtx: TalentContext = {
        ...talentContext,
        talentId,
        talentName: `${talentContext.profile.firstName || ''} ${talentContext.profile.lastName || ''}`.trim() || talentContext.profile.email,
        language: userLanguage,
        session: {
          currentMode: session.mode,
          conversationTopic: session.title,
        },
      };
      agent = createTalentAgent(talentCtx);
    }

    // Save user message FIRST (needed in history)
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content, attachments) VALUES ($1, 'user', $2, $3)`,
      [sessionId, sanitizeForPg(message.trim()), sanitizeJsonForPg(null)]
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
      // Load history (includes the user message we just saved)
      pool.query(
        `SELECT role, content FROM copilot_messages
         WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
        [sessionId]
      ),
    ]);

    // Update user message with attachments if present (non-blocking, fire-and-forget)
    if (messageAttachments) {
      pool.query(
        `UPDATE copilot_messages SET attachments = $1
         WHERE session_id = $2 AND role = 'user' ORDER BY created_at DESC LIMIT 1`,
        [sanitizeJsonForPg(messageAttachments), sessionId]
      ).catch(() => {});
    }

    // Exclude the user message we just added (last one), then summarize if needed
    const rawHistory = historyRes.rows.slice(0, -1).map((r: any) => ({
      role: r.role,
      content: r.content,
    }));
    const history = await summarizeHistoryIfNeeded(rawHistory);

    // Run agent with SSE streaming (pass attachments so agent sees file context)
    const parsedAttachments = messageAttachments ? JSON.parse(messageAttachments) : undefined;
    const { finalOutput, toolTrace, segments } = await runAgentWithSSE(
      agent,
      message.trim(),
      history,
      res,
      parsedAttachments
    );

    // Save assistant response (persist segments in output_data for reload)
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content, tool_calls, output_data)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [
        sessionId,
        sanitizeForPg(finalOutput),
        toolTrace.length > 0 ? sanitizeJsonForPg(toolTrace) : null,
        segments.length > 0 ? sanitizeJsonForPg(segments) : null,
      ]
    );

    // Generate title for first message (non-blocking)
    const messageCount = historyRes.rows.length;
    if (messageCount <= 2) {
      generateSessionTitle(message.trim()).then((title) => {
        copilotService.updateSessionTitle(sessionId, title).catch(() => { });
      });
    }

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

    // 1. Check cache FIRST — before any DB/AI calls
    const cacheKey = `${talentId}:${sessionId || 'new'}:${mode}`;
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

    // 3. Generate suggestions with gpt-5-nano
    const { run } = await import('@openai/agents');
    const { createIntentSuggestionsAgent } = await import('../services/ai/agent-factory');
    const { buildIntentSuggestionsPrompt } = await import('../services/ai/prompts/session-utils.prompt');

    const systemPrompt = buildIntentSuggestionsPrompt(mode, historyRows, talentContext);
    const agent = createIntentSuggestionsAgent(systemPrompt);

    let suggestions: string[] = [];
    try {
      const result = await run(agent, 'Génère les 4 suggestions.');
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

      // Import OpenAI client
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

      for (const file of files) {
        const validation = validateFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        if (!validation.valid) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
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

    const sessions = await copilotService.listSessions(talentId, limit);

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
 * Body: { mode: 'explore' | 'study' }
 * Returns: CopilotSession
 */
router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const { mode } = req.body;
    const validMode: CopilotMode = COPILOT_MODES.EXPLORE;

    const session = await copilotService.createSession(talentId, validMode);

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

    const session = await copilotService.getSession(sessionId, talentId);
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

    // Verify session belongs to user
    const session = await copilotService.getSession(sessionId, talentId);
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
