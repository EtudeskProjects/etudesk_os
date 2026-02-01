/**
 * Learning Tools for Copilot
 * Tools for flashcards, quizzes, and spaced repetition
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../database';
import {
  Flashcard,
  CreateFlashcard,
  calculateSM2,
  isDue,
  SM2Quality,
  Quiz,
  QuizQuestion,
  QuizResult,
} from '../ontology/learning';
import {
  FlashcardOutput,
  MiniQuizOutput,
  DueCardsOutput,
  ProgressReviewOutput,
} from '../ontology/outputs';

// ═══════════════════════════════════════════════════════════════
// FLASHCARD TOOLS
// ═══════════════════════════════════════════════════════════════

export const createFlashcardSchema = z.object({
  topicId: z.string().uuid().optional().describe('ID du sujet parent'),
  topicName: z.string().optional().describe('Nom du sujet (créé si inexistant)'),
  front: z.string().describe('Question ou recto de la carte'),
  back: z.string().describe('Réponse ou verso de la carte'),
  hint: z.string().optional().describe('Indice optionnel'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string()).optional(),
});

export type CreateFlashcardParams = z.infer<typeof createFlashcardSchema>;

export async function createFlashcard(
  params: CreateFlashcardParams,
  context: { talentId: string }
): Promise<FlashcardOutput> {
  const { talentId } = context;
  const { topicId, topicName, front, back, hint, difficulty, tags } = params;

  let finalTopicId = topicId;

  // Create topic if name provided and no ID
  if (!finalTopicId && topicName) {
    const topicResult = await pool.query(
      `
      INSERT INTO learning_topics (id, talent_id, name, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (talent_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
      [uuidv4(), talentId, topicName]
    );
    finalTopicId = topicResult.rows[0].id;
  }

  const flashcardId = uuidv4();
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + 1);

  await pool.query(
    `
    INSERT INTO learning_flashcards (
      id, talent_id, topic_id, front, back, hint, difficulty, tags,
      ease_factor, interval_days, repetitions, next_review_date,
      source_type, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2.5, 1, 0, $9, 'ai_generated', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `,
    [flashcardId, talentId, finalTopicId, front, back, hint, difficulty, tags || [], nextReviewDate]
  );

  return {
    type: 'study_flashcard',
    id: flashcardId,
    topicId: finalTopicId,
    front,
    back,
    hint,
    difficulty,
    tags,
    isReview: false,
  };
}

export const getDueCardsSchema = z.object({
  topicId: z.string().uuid().optional().describe('Filtrer par sujet'),
  limit: z.number().min(1).max(50).default(10),
});

export type GetDueCardsParams = z.infer<typeof getDueCardsSchema>;

export async function getDueCards(
  params: GetDueCardsParams,
  context: { talentId: string }
): Promise<DueCardsOutput> {
  const { talentId } = context;
  const { topicId, limit } = params;

  // Get due cards count by topic
  let countQuery = `
    SELECT
      lt.id as topic_id, lt.name as topic_name,
      COUNT(lf.id) as due_count
    FROM learning_topics lt
    LEFT JOIN learning_flashcards lf ON lf.topic_id = lt.id
      AND lf.is_active = true
      AND lf.next_review_date <= CURRENT_TIMESTAMP
    WHERE lt.talent_id = $1
  `;
  const countParams: (string | number)[] = [talentId];

  if (topicId) {
    countQuery += ' AND lt.id = $2';
    countParams.push(topicId);
  }

  countQuery += ' GROUP BY lt.id, lt.name ORDER BY due_count DESC';

  const countResult = await pool.query(countQuery, countParams);

  const byTopic = countResult.rows.map((r) => ({
    topicId: r.topic_id,
    topicName: r.topic_name,
    dueCount: parseInt(r.due_count) || 0,
  }));

  const totalDue = byTopic.reduce((sum, t) => sum + t.dueCount, 0);

  // Get next card
  let nextCard: FlashcardOutput | undefined;
  if (totalDue > 0) {
    let cardQuery = `
      SELECT
        lf.id, lf.topic_id, lf.front, lf.back, lf.hint, lf.difficulty, lf.tags,
        lf.next_review_date, lf.total_reviews
      FROM learning_flashcards lf
      WHERE lf.talent_id = $1
        AND lf.is_active = true
        AND lf.next_review_date <= CURRENT_TIMESTAMP
    `;
    const cardParams: string[] = [talentId];

    if (topicId) {
      cardQuery += ' AND lf.topic_id = $2';
      cardParams.push(topicId);
    }

    cardQuery += ' ORDER BY lf.next_review_date ASC LIMIT 1';

    const cardResult = await pool.query(cardQuery, cardParams);

    if (cardResult.rows.length > 0) {
      const c = cardResult.rows[0];
      nextCard = {
        type: 'study_flashcard',
        id: c.id,
        topicId: c.topic_id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        difficulty: c.difficulty,
        tags: c.tags,
        isReview: true,
        dueDate: c.next_review_date?.toISOString(),
        reviewCount: c.total_reviews,
      };
    }
  }

  return {
    type: 'study_due_cards',
    totalDue,
    byTopic,
    nextCard,
  };
}

export const recordReviewSchema = z.object({
  flashcardId: z.string().uuid(),
  quality: z.number().min(0).max(5).describe('Qualité SM-2: 0=oubli total, 5=parfait'),
});

export type RecordReviewParams = z.infer<typeof recordReviewSchema>;

export async function recordReview(
  params: RecordReviewParams,
  context: { talentId: string }
): Promise<{ success: boolean; nextReviewDate: string; message: string }> {
  const { talentId } = context;
  const { flashcardId, quality } = params;

  // Get current card state
  const cardResult = await pool.query(
    `
    SELECT ease_factor, interval_days, repetitions
    FROM learning_flashcards
    WHERE id = $1 AND talent_id = $2
  `,
    [flashcardId, talentId]
  );

  if (cardResult.rows.length === 0) {
    throw new Error('Flashcard non trouvée');
  }

  const card = cardResult.rows[0];
  const sm2Result = calculateSM2(
    quality,
    card.ease_factor,
    card.interval_days,
    card.repetitions
  );

  // Update card
  await pool.query(
    `
    UPDATE learning_flashcards SET
      ease_factor = $1,
      interval_days = $2,
      repetitions = $3,
      next_review_date = $4,
      last_review_date = CURRENT_TIMESTAMP,
      last_quality = $5,
      total_reviews = total_reviews + 1,
      correct_reviews = correct_reviews + CASE WHEN $5 >= 3 THEN 1 ELSE 0 END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
  `,
    [
      sm2Result.newEaseFactor,
      sm2Result.newInterval,
      sm2Result.repetitions,
      sm2Result.nextReviewDate,
      quality,
      flashcardId,
    ]
  );

  // Update topic last studied
  await pool.query(
    `
    UPDATE learning_topics SET
      last_studied_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT topic_id FROM learning_flashcards WHERE id = $1)
  `,
    [flashcardId]
  );

  const message =
    quality >= 4
      ? 'Excellent ! Prochaine révision dans ' + sm2Result.newInterval + ' jours.'
      : quality >= 3
        ? 'Bien ! Révision dans ' + sm2Result.newInterval + ' jours.'
        : 'Continuez à pratiquer ! Révision demain.';

  return {
    success: true,
    nextReviewDate: sm2Result.nextReviewDate,
    message,
  };
}

// ═══════════════════════════════════════════════════════════════
// QUIZ TOOLS
// ═══════════════════════════════════════════════════════════════

export const createQuizSchema = z.object({
  topic: z.string().describe('Sujet du quiz'),
  questionCount: z.number().min(3).max(20).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  questionTypes: z
    .array(z.enum(['multiple_choice', 'true_false', 'fill_blank']))
    .default(['multiple_choice', 'true_false']),
});

export type CreateQuizParams = z.infer<typeof createQuizSchema>;

export async function createQuiz(
  params: CreateQuizParams,
  context: { talentId: string }
): Promise<MiniQuizOutput> {
  const { topic, questionCount, difficulty, questionTypes } = params;

  // This would typically call the AI to generate questions
  // For now, return a placeholder structure
  const quizId = uuidv4();

  const questions: MiniQuizOutput['questions'] = [];

  // Generate placeholder questions
  for (let i = 0; i < questionCount; i++) {
    const qType = questionTypes[i % questionTypes.length];
    const questionId = uuidv4();

    if (qType === 'multiple_choice') {
      questions.push({
        id: questionId,
        question: `Question ${i + 1} sur ${topic}`,
        questionType: 'multiple_choice',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: `Explication de la réponse pour la question ${i + 1}`,
      });
    } else if (qType === 'true_false') {
      questions.push({
        id: questionId,
        question: `Affirmation ${i + 1} sur ${topic}`,
        questionType: 'true_false',
        options: ['Vrai', 'Faux'],
        correctAnswer: Math.random() > 0.5 ? 'Vrai' : 'Faux',
        explanation: `Explication de la réponse`,
      });
    } else {
      questions.push({
        id: questionId,
        question: `Complétez: Le concept clé de ${topic} est ___`,
        questionType: 'fill_blank',
        correctAnswer: 'réponse',
        explanation: `Explication de la réponse`,
      });
    }
  }

  return {
    type: 'study_mini_quiz',
    id: quizId,
    title: `Quiz: ${topic}`,
    description: `Testez vos connaissances sur ${topic}`,
    questions,
    passingScore: 70,
  };
}

export const evaluateQuizAnswerSchema = z.object({
  questionId: z.string(),
  userAnswer: z.union([z.string(), z.number(), z.array(z.string())]),
  correctAnswer: z.union([z.string(), z.number(), z.array(z.string())]),
  questionType: z.enum(['multiple_choice', 'true_false', 'fill_blank', 'code']),
});

export type EvaluateQuizAnswerParams = z.infer<typeof evaluateQuizAnswerSchema>;

export async function evaluateQuizAnswer(
  params: EvaluateQuizAnswerParams,
  context: { talentId: string }
): Promise<{ isCorrect: boolean; feedback: string }> {
  const { userAnswer, correctAnswer, questionType } = params;

  let isCorrect = false;

  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    isCorrect = userAnswer === correctAnswer;
  } else if (questionType === 'fill_blank') {
    // Normalize and compare
    const normalizedUser = String(userAnswer).toLowerCase().trim();
    const normalizedCorrect = String(correctAnswer).toLowerCase().trim();
    isCorrect = normalizedUser === normalizedCorrect;
  }

  const feedback = isCorrect ? 'Correct ! Bien joué.' : `Incorrect. La bonne réponse était: ${correctAnswer}`;

  return { isCorrect, feedback };
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS TOOLS
// ═══════════════════════════════════════════════════════════════

export const getProgressSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('week'),
});

export type GetProgressParams = z.infer<typeof getProgressSchema>;

export async function getProgress(
  params: GetProgressParams,
  context: { talentId: string }
): Promise<ProgressReviewOutput> {
  const { talentId } = context;
  const { period } = params;

  // Determine date range
  let dateFilter = '';
  if (period === 'today') {
    dateFilter = "AND ls.started_at >= CURRENT_DATE";
  } else if (period === 'week') {
    dateFilter = "AND ls.started_at >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === 'month') {
    dateFilter = "AND ls.started_at >= CURRENT_DATE - INTERVAL '30 days'";
  }

  // Get session stats
  const statsResult = await pool.query(
    `
    SELECT
      COUNT(DISTINCT lt.id) as topics_studied,
      COALESCE(SUM(ls.items_reviewed), 0) as cards_reviewed,
      COUNT(DISTINCT CASE WHEN ls.session_type = 'quiz' THEN ls.id END) as quizzes_taken,
      COALESCE(AVG(ls.average_quality), 0) as avg_quality,
      COALESCE(SUM(ls.duration), 0) as total_time
    FROM learning_sessions ls
    LEFT JOIN learning_topics lt ON ls.topic_id = lt.id
    WHERE ls.talent_id = $1 ${dateFilter}
  `,
    [talentId]
  );

  const stats = statsResult.rows[0];

  // Get recent topics
  const topicsResult = await pool.query(
    `
    SELECT
      lt.id, lt.name, lt.mastery_level, lt.last_studied_at
    FROM learning_topics lt
    WHERE lt.talent_id = $1
    ORDER BY lt.last_studied_at DESC NULLS LAST
    LIMIT 5
  `,
    [talentId]
  );

  // Calculate streak
  const streakResult = await pool.query(
    `
    WITH daily_activity AS (
      SELECT DATE(started_at) as study_date
      FROM learning_sessions
      WHERE talent_id = $1
      GROUP BY DATE(started_at)
    ),
    streak AS (
      SELECT study_date,
        ROW_NUMBER() OVER (ORDER BY study_date DESC) as rn,
        study_date - (ROW_NUMBER() OVER (ORDER BY study_date DESC))::int as grp
      FROM daily_activity
    )
    SELECT COUNT(*) as streak_days
    FROM streak
    WHERE grp = (SELECT grp FROM streak WHERE rn = 1 LIMIT 1)
  `,
    [talentId]
  );

  const streakDays = parseInt(streakResult.rows[0]?.streak_days) || 0;

  return {
    type: 'study_progress_review',
    period,
    stats: {
      topicsStudied: parseInt(stats.topics_studied) || 0,
      cardsReviewed: parseInt(stats.cards_reviewed) || 0,
      quizzesTaken: parseInt(stats.quizzes_taken) || 0,
      averageScore: Math.round((parseFloat(stats.avg_quality) / 5) * 100) || 0,
      streakDays,
      totalStudyTime: parseInt(stats.total_time) || 0,
    },
    recentTopics: topicsResult.rows.map((t) => ({
      id: t.id,
      name: t.name,
      progress: t.mastery_level || 0,
      lastStudied: t.last_studied_at?.toISOString() || '',
    })),
    recommendations: streakDays === 0 ? ["Commencez votre série d'étude aujourd'hui !"] : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// TOPIC TOOLS
// ═══════════════════════════════════════════════════════════════

export const createTopicSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parentTopicId: z.string().uuid().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateTopicParams = z.infer<typeof createTopicSchema>;

export async function createTopic(
  params: CreateTopicParams,
  context: { talentId: string }
): Promise<{ id: string; name: string }> {
  const { talentId } = context;
  const { name, description, parentTopicId, domain, tags } = params;

  const topicId = uuidv4();

  await pool.query(
    `
    INSERT INTO learning_topics (
      id, talent_id, name, description, parent_topic_id, domain, tags,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `,
    [topicId, talentId, name, description, parentTopicId, domain, tags || []]
  );

  return { id: topicId, name };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const learningToolDefinitions = {
  create_flashcard: {
    name: 'create_flashcard',
    description:
      "Crée une nouvelle flashcard pour la révision espacée. Inclut question (front), réponse (back), et optionnellement un indice.",
    parameters: createFlashcardSchema,
    execute: createFlashcard,
  },
  get_due_cards: {
    name: 'get_due_cards',
    description:
      "Récupère les flashcards dues pour révision selon l'algorithme SM-2. Retourne le nombre de cartes dues par sujet et la prochaine carte à réviser.",
    parameters: getDueCardsSchema,
    execute: getDueCards,
  },
  record_review: {
    name: 'record_review',
    description:
      "Enregistre le résultat d'une révision de flashcard avec la qualité SM-2 (0-5). Met à jour l'intervalle de révision.",
    parameters: recordReviewSchema,
    execute: recordReview,
  },
  create_quiz: {
    name: 'create_quiz',
    description:
      'Crée un quiz interactif sur un sujet donné avec le nombre de questions et la difficulté spécifiés.',
    parameters: createQuizSchema,
    execute: createQuiz,
  },
  evaluate_quiz_answer: {
    name: 'evaluate_quiz_answer',
    description:
      "Évalue une réponse de quiz et fournit un feedback. Retourne si la réponse est correcte et l'explication.",
    parameters: evaluateQuizAnswerSchema,
    execute: evaluateQuizAnswer,
  },
  get_progress: {
    name: 'get_progress',
    description:
      "Récupère les statistiques de progression d'apprentissage pour une période donnée (today, week, month, all).",
    parameters: getProgressSchema,
    execute: getProgress,
  },
  create_topic: {
    name: 'create_topic',
    description:
      "Crée un nouveau sujet d'apprentissage pour organiser les flashcards et quiz.",
    parameters: createTopicSchema,
    execute: createTopic,
  },
};
