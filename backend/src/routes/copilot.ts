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
  EXPLORER_CONTEXT_OPTIONS,
  COPILOT_MODES,
  type CopilotMode,
  type TalentContext,
  type OrgContext,
} from '../services/copilot';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// CHAT ENDPOINT — SSE STREAMING
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/copilot/chat - Send a message to the copilot (SSE streaming)
 * Body: { sessionId?: string, message: string, mode?: 'explore' | 'study', organizationId?: string }
 * Response: Server-Sent Events stream
 */
router.post('/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Get or create session
    let sessionId = inputSessionId;
    let session: any = null;

    if (sessionId) {
      if (!session) {
        session = await copilotService.createSession(talentId, validMode);
        sessionId = session.id;
      }
    } else {
      session = await copilotService.createSession(talentId, validMode);
      sessionId = session.id;
    }

    // Load talent context
    const contextOptions = EXPLORER_CONTEXT_OPTIONS;
    const talentContext = await loadTalentContext(talentId, contextOptions);

    // Build agent context
    const isOrg = !!organizationId;
    let agent: any;

    if (isOrg) {
      // Find org info
      const orgInfo = talentContext.organizations?.organizations?.find(
        (o: any) => o.organizationId === organizationId
      );
      const orgCtx: OrgContext = {
        talentId,
        talentName: `${talentContext.profile.firstName} ${talentContext.profile.lastName}`,
        organizationId,
        organizationName: orgInfo?.organizationName || 'Organisation',
        role: orgInfo?.role || 'MEMBER',
        language: (req.language === 'en' ? 'en' : 'fr') as 'fr' | 'en',
      };
      agent = createOrgAgent(orgCtx);
    } else {
      const talentCtx: TalentContext = {
        ...talentContext,
        talentId,
        talentName: `${talentContext.profile.firstName || ''} ${talentContext.profile.lastName || ''}`.trim() || talentContext.profile.email,
        language: (req.language === 'en' ? 'en' : 'fr') as 'fr' | 'en',
        session: {
          currentMode: session.mode,
          conversationTopic: session.title,
        },
      };
      agent = createTalentAgent(talentCtx);
    }

    // Load attachment details if provided
    let messageAttachments = null;
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      const attachRes = await pool.query(
        `SELECT id, original_filename as name, file_url as url, mime_type as type, file_size as size 
         FROM talent_documents WHERE id = ANY($1) AND talent_id = $2`,
        [attachmentIds, talentId]
      );
      messageAttachments = JSON.stringify(attachRes.rows);
    }

    // Save user message
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content, attachments) VALUES ($1, 'user', $2, $3)`,
      [sessionId, message.trim(), messageAttachments]
    );

    // Get conversation history for context
    const historyRes = await pool.query(
      `SELECT role, content FROM copilot_messages
       WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [sessionId]
    );
    // Exclude the user message we just added (last one)
    const history = historyRes.rows.slice(0, -1).map((r: any) => ({
      role: r.role,
      content: r.content,
    }));

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
        finalOutput,
        toolTrace.length > 0 ? JSON.stringify(toolTrace) : null,
        segments.length > 0 ? JSON.stringify(segments) : null,
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
  lastMessageCount: number;
  timestamp: number;
}
const suggestionsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
    }

    const mode = (req.query.mode as string) || 'explore';
    const sessionId = req.query.sessionId as string | undefined;

    // 1. Parallel data fetching for context and history
    let conversationHistory: Array<{ role: string; content: string }> = [];
    let talentContext: { firstName?: string; goals?: string[]; sectors?: string[] } | undefined;

    const [historyRes, contextRes] = await Promise.all([
      sessionId ? (async () => {
        try {
          const { pool } = await import('../services/database');
          const result = await pool.query(
            `SELECT role, content FROM copilot_messages 
             WHERE session_id = $1 
             ORDER BY created_at DESC 
             LIMIT 4`,
            [sessionId]
          );
          return result.rows.reverse();
        } catch { return []; }
      })() : Promise.resolve([]),
      (async () => {
        try {
          const context = await loadTalentContext(talentId, EXPLORER_CONTEXT_OPTIONS);
          return {
            firstName: context.profile?.firstName,
            goals: (context.profile as any)?.goals,
            sectors: context.profile?.sectorsOfInterest,
          };
        } catch { return undefined; }
      })()
    ]);

    conversationHistory = historyRes;
    talentContext = contextRes;

    // 2. Check Cache with secondary hit detection (matching history length)
    const cacheKey = `${talentId}:${sessionId || 'new'}:${mode}`;
    const cached = suggestionsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && cached.lastMessageCount === conversationHistory.length) {
      return res.json({
        success: true,
        data: { suggestions: cached.suggestions }
      });
    }

    // 3. Generate suggestions with gpt-4.1-nano
    const { run } = await import('@openai/agents');
    const { createIntentSuggestionsAgent } = await import('../services/ai/agent-factory');
    const { buildIntentSuggestionsPrompt } = await import('../services/ai/prompts/session-utils.prompt');

    const systemPrompt = buildIntentSuggestionsPrompt(mode, conversationHistory, talentContext);
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
      suggestionsCache.set(cacheKey, {
        suggestions,
        lastMessageCount: conversationHistory.length,
        timestamp: Date.now()
      });
    } catch {
      suggestions = mode === 'study'
        ? ['Approfondir cette notion', 'Évaluer mes acquis', 'Élucider ce concept', 'Synthétiser la session']
        : ['Explorer les opportunités d\'élite', 'Solliciter cette institution', 'Bonifier mon profil', 'Découvrir des écosystèmes'];
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
        suggestions: ['Comment puis-je vous guider ?', 'Explorer les opportunités', 'Découvrir les communautés', 'Bonifier votre profil'],
      },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUDIO TRANSCRIPTION (Whisper STT)
// ═══════════════════════════════════════════════════════════════

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
        model: 'whisper-1',
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

// ═══════════════════════════════════════════════════════════════
// ATTACHMENT UPLOAD (Copilot file attachments → documents)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

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
