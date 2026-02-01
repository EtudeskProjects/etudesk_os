/**
 * Copilot API Routes
 * Routes for AI copilot chat and session management
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { copilotService } from '../services/copilot/copilot.service';
import { COPILOT_MODES, CopilotMode } from '../services/copilot/ontology/schema';
import {
  DOCUMENT_LIMITS,
  ALLOWED_MIME_TYPES,
} from '../constants/documents';
import {
  uploadDocument,
  canUploadDocument,
  validateFile,
} from '../services/documents/document.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// CHAT ENDPOINT
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/copilot/chat - Send a message to the copilot
 * Body: { sessionId?: string, message: string, mode?: 'explore' | 'study' }
 * If mode is not provided, the triage agent will determine the best mode
 * Returns: { sessionId: string, message: CopilotMessage, context?: SessionContext }
 */
router.post('/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { sessionId, message, mode } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Le message est requis' });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: 'Le message est trop long (max 4000 caractères)' });
    }

    // Validate mode (optional now - triage will determine if not provided)
    let validMode: CopilotMode | undefined;
    if (mode === COPILOT_MODES.STUDY) {
      validMode = COPILOT_MODES.STUDY;
    } else if (mode === COPILOT_MODES.EXPLORE) {
      validMode = COPILOT_MODES.EXPLORE;
    }
    // If no valid mode provided, let the service use triage

    // Process message
    const response = await copilotService.processMessage({
      sessionId,
      message: message.trim(),
      mode: validMode,
      talentId,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error in copilot chat:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement du message',
    });
  }
});

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
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
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
      console.error('Error uploading copilot attachment:', error);
      res.status(500).json({
        error: "Erreur lors de l'upload du fichier",
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
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const sessions = await copilotService.listSessions(talentId, limit);

    res.json({
      success: true,
      data: { sessions },
    });
  } catch (error) {
    console.error('Error listing copilot sessions:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des sessions',
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
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { mode } = req.body;
    const validMode: CopilotMode =
      mode === COPILOT_MODES.STUDY ? COPILOT_MODES.STUDY : COPILOT_MODES.EXPLORE;

    const session = await copilotService.createSession(talentId, validMode);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error creating copilot session:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de la session',
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
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const sessionId = req.params.id;

    const session = await copilotService.getSession(sessionId, talentId);
    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    const messages = await copilotService.getSessionMessages(sessionId);

    res.json({
      success: true,
      data: { session, messages },
    });
  } catch (error) {
    console.error('Error getting copilot session:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la session',
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
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const sessionId = req.params.id;

    const deleted = await copilotService.deleteSession(sessionId, talentId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.json({
      success: true,
      message: 'Session supprimée',
    });
  } catch (error) {
    console.error('Error deleting copilot session:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de la session',
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
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const sessionId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Verify session belongs to user
    const session = await copilotService.getSession(sessionId, talentId);
    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    const messages = await copilotService.getSessionMessages(sessionId, limit);

    res.json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error('Error getting copilot messages:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des messages',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// LEARNING ENDPOINTS (For study mode)
// ═══════════════════════════════════════════════════════════════

import { pool } from '../services/database';

/**
 * GET /api/copilot/learning/progress - Get learning progress summary
 * Returns: { topics, totalFlashcards, dueFlashcards, streak, etc. }
 */
router.get('/learning/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Get topics with flashcard counts
    const topicsResult = await pool.query(
      `
      SELECT
        lt.id, lt.topic_name, lt.mastery_level, lt.last_studied_at,
        COUNT(lf.id) as flashcard_count,
        COUNT(lf.id) FILTER (WHERE lf.next_review_at <= CURRENT_DATE) as due_count
      FROM learning_topics lt
      LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
      WHERE lt.talent_id = $1
      GROUP BY lt.id
      ORDER BY lt.topic_name
      `,
      [talentId]
    );

    // Get overall stats
    const statsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT lt.id) as total_topics,
        COUNT(lf.id) as total_flashcards,
        COUNT(lf.id) FILTER (WHERE lf.next_review_at <= CURRENT_DATE) as due_flashcards
      FROM learning_topics lt
      LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
      WHERE lt.talent_id = $1
      `,
      [talentId]
    );

    // Get streak
    const streakResult = await pool.query(
      `
      SELECT current_streak_days, total_study_time_minutes, last_study_date
      FROM learning_preferences
      WHERE talent_id = $1
      `,
      [talentId]
    );

    res.json({
      success: true,
      data: {
        topics: topicsResult.rows.map((t) => ({
          id: t.id,
          name: t.topic_name,
          masteryLevel: t.mastery_level || 0,
          flashcardCount: parseInt(t.flashcard_count) || 0,
          dueCount: parseInt(t.due_count) || 0,
          lastStudiedAt: t.last_studied_at,
        })),
        totalTopics: parseInt(statsResult.rows[0]?.total_topics) || 0,
        totalFlashcards: parseInt(statsResult.rows[0]?.total_flashcards) || 0,
        dueFlashcards: parseInt(statsResult.rows[0]?.due_flashcards) || 0,
        streakDays: streakResult.rows[0]?.current_streak_days || 0,
        totalStudyTimeMinutes: streakResult.rows[0]?.total_study_time_minutes || 0,
        lastStudyDate: streakResult.rows[0]?.last_study_date,
      },
    });
  } catch (error) {
    console.error('Error getting learning progress:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la progression',
    });
  }
});

/**
 * GET /api/copilot/learning/due - Get due flashcards for review
 * Query: { topicId?: string, limit?: number }
 * Returns: { flashcards: Array<{ id, front, back, topic, difficulty }> }
 */
router.get('/learning/due', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const topicId = req.query.topicId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    let query = `
      SELECT
        lf.id, lf.front_content, lf.back_content, lf.difficulty, lf.ease_factor,
        lf.interval_days, lf.repetitions, lf.next_review_at,
        lt.id as topic_id, lt.topic_name as topic_name
      FROM learning_flashcards lf
      JOIN learning_topics lt ON lf.topic_id = lt.id
      WHERE lt.talent_id = $1 AND lf.next_review_at <= CURRENT_DATE
    `;
    const params: any[] = [talentId];

    if (topicId) {
      query += ` AND lf.topic_id = $2`;
      params.push(topicId);
    }

    query += ` ORDER BY lf.next_review_at ASC, lf.difficulty DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        flashcards: result.rows.map((f) => ({
          id: f.id,
          front: f.front_content,
          back: f.back_content,
          difficulty: f.difficulty,
          topic: {
            id: f.topic_id,
            name: f.topic_name,
          },
          easinessFactor: f.ease_factor,
          intervalDays: f.interval_days,
          repetitionCount: f.repetitions,
          nextReviewDate: f.next_review_at,
        })),
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error getting due flashcards:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des cartes',
    });
  }
});

/**
 * POST /api/copilot/learning/review - Record a flashcard review
 * Body: { flashcardId: string, quality: number (0-5) }
 * Quality scale: 0=complete blackout, 1=wrong, 2=hard, 3=correct hard, 4=correct easy, 5=perfect
 * Returns: { updated flashcard stats, next review date }
 */
router.post('/learning/review', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { flashcardId, quality } = req.body;

    // Validate quality
    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'La qualité doit être un nombre entre 0 et 5' });
    }

    // Verify flashcard belongs to user
    const verifyResult = await pool.query(
      `
      SELECT lf.id, lf.ease_factor, lf.interval_days, lf.repetitions
      FROM learning_flashcards lf
      JOIN learning_topics lt ON lf.topic_id = lt.id
      WHERE lf.id = $1 AND lt.talent_id = $2
      `,
      [flashcardId, talentId]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Carte non trouvée' });
    }

    // Inline SM-2 algorithm
    const card = verifyResult.rows[0];
    let ef = card.ease_factor;
    let interval = card.interval_days;
    let reps = card.repetitions;

    // SM-2: update ease factor
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;

    if (quality < 3) {
      reps = 0;
      interval = 1;
    } else {
      reps += 1;
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
    }

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    // Update card
    const updatedResult = await pool.query(
      `
      UPDATE learning_flashcards SET
        ease_factor = $1,
        interval_days = $2,
        repetitions = $3,
        next_review_at = $4,
        last_reviewed_at = CURRENT_TIMESTAMP,
        last_quality = $5,
        total_reviews = total_reviews + 1,
        correct_reviews = correct_reviews + CASE WHEN $5 >= 3 THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at
      `,
      [ef, interval, reps, nextReviewAt, quality, flashcardId]
    );

    res.json({
      success: true,
      data: {
        flashcardId,
        quality,
        newStats: {
          easinessFactor: updatedResult.rows[0].ease_factor,
          intervalDays: updatedResult.rows[0].interval_days,
          repetitionCount: updatedResult.rows[0].repetitions,
          nextReviewDate: updatedResult.rows[0].next_review_at,
          lastReviewedAt: updatedResult.rows[0].last_reviewed_at,
        },
      },
    });
  } catch (error) {
    console.error('Error recording flashcard review:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'enregistrement de la révision',
    });
  }
});

/**
 * GET /api/copilot/learning/topics - Get user's learning topics
 * Returns: { topics: Array<{ id, name, masteryLevel, flashcardCount }> }
 */
router.get('/learning/topics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const result = await pool.query(
      `
      SELECT
        lt.id, lt.topic_name, lt.parent_topic_id,
        lt.mastery_level, lt.last_studied_at, lt.created_at,
        COUNT(lf.id) as flashcard_count
      FROM learning_topics lt
      LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
      WHERE lt.talent_id = $1
      GROUP BY lt.id
      ORDER BY lt.topic_name
      `,
      [talentId]
    );

    res.json({
      success: true,
      data: {
        topics: result.rows.map((t) => ({
          id: t.id,
          name: t.topic_name,
          parentTopicId: t.parent_topic_id,
          masteryLevel: t.mastery_level || 0,
          flashcardCount: parseInt(t.flashcard_count) || 0,
          lastStudiedAt: t.last_studied_at,
          createdAt: t.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting learning topics:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des sujets',
    });
  }
});

export default router;
