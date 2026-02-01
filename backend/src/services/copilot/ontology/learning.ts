/**
 * Learning Memory Types
 * Defines structures for spaced repetition learning system
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// SPACED REPETITION (SM-2 ALGORITHM)
// ═══════════════════════════════════════════════════════════════

/**
 * SM-2 Algorithm Quality Ratings
 * 0 - Complete blackout, no recall
 * 1 - Incorrect response, but upon seeing correct answer, remembered
 * 2 - Incorrect response, but correct answer seemed easy to recall
 * 3 - Correct response with serious difficulty
 * 4 - Correct response after hesitation
 * 5 - Perfect response with no hesitation
 */
export const SM2_QUALITY = {
  BLACKOUT: 0,
  INCORRECT_REMEMBERED: 1,
  INCORRECT_EASY: 2,
  CORRECT_DIFFICULT: 3,
  CORRECT_HESITATION: 4,
  PERFECT: 5,
} as const;

export type SM2Quality = (typeof SM2_QUALITY)[keyof typeof SM2_QUALITY];

export const SM2ReviewResultSchema = z.object({
  quality: z.number().min(0).max(5),
  newEaseFactor: z.number().min(1.3),
  newInterval: z.number().min(1), // days
  nextReviewDate: z.string(),
  repetitions: z.number(),
});

export type SM2ReviewResult = z.infer<typeof SM2ReviewResultSchema>;

// ═══════════════════════════════════════════════════════════════
// LEARNING TOPICS
// ═══════════════════════════════════════════════════════════════

export const LearningTopicSchema = z.object({
  id: z.string(),
  talentId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parentTopicId: z.string().optional(),
  domain: z.string().optional(), // e.g., "programming", "business", "language"

  // Progress tracking
  masteryLevel: z.number().min(0).max(100).default(0),
  totalStudyTime: z.number().default(0), // minutes
  sessionsCount: z.number().default(0),

  // Stats
  flashcardCount: z.number().default(0),
  quizCount: z.number().default(0),
  exerciseCount: z.number().default(0),

  // Metadata
  tags: z.array(z.string()).optional(),
  sourceDocumentId: z.string().optional(), // If created from a document
  externalUrl: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  lastStudiedAt: z.string().optional(),
});

export type LearningTopic = z.infer<typeof LearningTopicSchema>;

// ═══════════════════════════════════════════════════════════════
// FLASHCARDS
// ═══════════════════════════════════════════════════════════════

export const FlashcardDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type FlashcardDifficulty = z.infer<typeof FlashcardDifficultySchema>;

export const FlashcardSchema = z.object({
  id: z.string(),
  talentId: z.string(),
  topicId: z.string().optional(),

  // Content
  front: z.string(), // Question/prompt
  back: z.string(), // Answer
  hint: z.string().optional(),
  explanation: z.string().optional(),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),

  // Classification
  difficulty: FlashcardDifficultySchema.default('medium'),
  tags: z.array(z.string()).optional(),

  // SM-2 spaced repetition fields
  easeFactor: z.number().min(1.3).default(2.5),
  interval: z.number().min(1).default(1), // days
  repetitions: z.number().default(0),
  nextReviewDate: z.string().optional(),
  lastReviewDate: z.string().optional(),
  lastQuality: z.number().min(0).max(5).optional(),

  // Stats
  totalReviews: z.number().default(0),
  correctReviews: z.number().default(0),
  averageQuality: z.number().optional(),

  // Source tracking
  sourceType: z.enum(['manual', 'ai_generated', 'document', 'quiz']).default('ai_generated'),
  sourceId: z.string().optional(),

  // Status
  isActive: z.boolean().default(true),
  isSuspended: z.boolean().default(false),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

// Flashcard for creation (without DB fields)
export const CreateFlashcardSchema = FlashcardSchema.pick({
  topicId: true,
  front: true,
  back: true,
  hint: true,
  explanation: true,
  imageUrl: true,
  difficulty: true,
  tags: true,
  sourceType: true,
  sourceId: true,
});

export type CreateFlashcard = z.infer<typeof CreateFlashcardSchema>;

// ═══════════════════════════════════════════════════════════════
// QUIZ STRUCTURES
// ═══════════════════════════════════════════════════════════════

export const QuizQuestionTypeSchema = z.enum([
  'multiple_choice',
  'true_false',
  'fill_blank',
  'code',
  'matching',
  'ordering',
]);

export type QuizQuestionType = z.infer<typeof QuizQuestionTypeSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionType: QuizQuestionTypeSchema,

  // For multiple choice
  options: z.array(z.string()).optional(),
  correctOptionIndex: z.number().optional(),

  // For true/false
  correctBoolean: z.boolean().optional(),

  // For fill blank
  correctText: z.string().optional(),
  acceptedVariations: z.array(z.string()).optional(),

  // For code questions
  codeLanguage: z.string().optional(),
  codeTemplate: z.string().optional(),
  expectedOutput: z.string().optional(),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
      })
    )
    .optional(),

  // For matching
  matchingPairs: z
    .array(
      z.object({
        left: z.string(),
        right: z.string(),
      })
    )
    .optional(),

  // For ordering
  correctOrder: z.array(z.string()).optional(),

  // Common fields
  explanation: z.string().optional(),
  points: z.number().default(1),
  difficulty: FlashcardDifficultySchema.default('medium'),
  hint: z.string().optional(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  id: z.string(),
  talentId: z.string(),
  topicId: z.string().optional(),

  title: z.string(),
  description: z.string().optional(),
  questions: z.array(QuizQuestionSchema),

  // Settings
  timeLimit: z.number().optional(), // seconds
  passingScore: z.number().default(70), // percentage
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  showCorrectAnswers: z.boolean().default(true),
  allowRetry: z.boolean().default(true),

  // Stats
  totalAttempts: z.number().default(0),
  averageScore: z.number().optional(),
  bestScore: z.number().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Quiz = z.infer<typeof QuizSchema>;

// Quiz attempt/result
export const QuizResultSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  talentId: z.string(),

  // Results
  score: z.number().min(0).max(100),
  correctCount: z.number(),
  totalQuestions: z.number(),
  timeSpent: z.number().optional(), // seconds
  passed: z.boolean(),

  // Per-question results
  answers: z.array(
    z.object({
      questionId: z.string(),
      userAnswer: z.unknown(),
      isCorrect: z.boolean(),
      pointsEarned: z.number(),
      timeSpent: z.number().optional(),
    })
  ),

  completedAt: z.string(),
});

export type QuizResult = z.infer<typeof QuizResultSchema>;

// ═══════════════════════════════════════════════════════════════
// CODE EXERCISES
// ═══════════════════════════════════════════════════════════════

export const CodeExerciseSchema = z.object({
  id: z.string(),
  talentId: z.string(),
  topicId: z.string().optional(),

  // Content
  title: z.string(),
  description: z.string(),
  language: z.enum([
    'javascript',
    'typescript',
    'python',
    'java',
    'cpp',
    'csharp',
    'go',
    'rust',
    'html',
    'css',
    'sql',
  ]),
  initialCode: z.string(),
  solutionCode: z.string().optional(),

  // Testing
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isHidden: z.boolean().default(false),
      description: z.string().optional(),
    })
  ),

  // Hints
  hints: z.array(z.string()).optional(),

  // Metadata
  difficulty: FlashcardDifficultySchema.default('medium'),
  estimatedTime: z.number().optional(), // minutes
  tags: z.array(z.string()).optional(),

  // Stats
  attemptCount: z.number().default(0),
  completionCount: z.number().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CodeExercise = z.infer<typeof CodeExerciseSchema>;

// ═══════════════════════════════════════════════════════════════
// LEARNING SESSIONS
// ═══════════════════════════════════════════════════════════════

export const LearningSessionSchema = z.object({
  id: z.string(),
  talentId: z.string(),
  topicId: z.string().optional(),
  sessionType: z.enum(['flashcard_review', 'quiz', 'study', 'exercise']),

  // Duration
  startedAt: z.string(),
  endedAt: z.string().optional(),
  duration: z.number().optional(), // minutes

  // Results
  itemsReviewed: z.number().default(0),
  correctCount: z.number().default(0),
  averageQuality: z.number().optional(),

  // For flashcard sessions
  cardsReviewed: z
    .array(
      z.object({
        flashcardId: z.string(),
        quality: z.number().min(0).max(5),
        responseTime: z.number().optional(), // ms
      })
    )
    .optional(),

  // For quiz sessions
  quizResultId: z.string().optional(),

  // Notes
  notes: z.string().optional(),
});

export type LearningSession = z.infer<typeof LearningSessionSchema>;

// ═══════════════════════════════════════════════════════════════
// LEARNING PREFERENCES
// ═══════════════════════════════════════════════════════════════

export const LearningPreferencesSchema = z.object({
  talentId: z.string(),

  // Daily goals
  dailyCardGoal: z.number().default(20),
  dailyStudyTimeGoal: z.number().default(30), // minutes

  // Spaced repetition settings
  newCardsPerDay: z.number().default(10),
  maxReviewsPerDay: z.number().default(100),
  learnSteps: z.array(z.number()).default([1, 10, 1440]), // minutes

  // Notifications
  reminderEnabled: z.boolean().default(true),
  reminderTime: z.string().optional(), // HH:mm format
  weekendReminders: z.boolean().default(true),

  // Display preferences
  showTimer: z.boolean().default(true),
  autoPlayAudio: z.boolean().default(false),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),

  // Learning style
  preferredQuestionTypes: z.array(QuizQuestionTypeSchema).optional(),
  preferredDifficulty: FlashcardDifficultySchema.optional(),

  updatedAt: z.string(),
});

export type LearningPreferences = z.infer<typeof LearningPreferencesSchema>;

// ═══════════════════════════════════════════════════════════════
// LEARNING STATS
// ═══════════════════════════════════════════════════════════════

export const LearningStatsSchema = z.object({
  talentId: z.string(),

  // Totals
  totalTopics: z.number().default(0),
  totalFlashcards: z.number().default(0),
  totalQuizzes: z.number().default(0),
  totalExercises: z.number().default(0),

  // Reviews
  totalReviews: z.number().default(0),
  totalStudyTime: z.number().default(0), // minutes

  // Streaks
  currentStreak: z.number().default(0),
  longestStreak: z.number().default(0),
  lastStudyDate: z.string().optional(),

  // Performance
  averageAccuracy: z.number().optional(),
  averageQuizScore: z.number().optional(),

  // Due items
  dueFlashcards: z.number().default(0),
  overdueFlashcards: z.number().default(0),

  // By difficulty
  masteredCards: z.number().default(0),
  learningCards: z.number().default(0),
  newCards: z.number().default(0),

  updatedAt: z.string(),
});

export type LearningStats = z.infer<typeof LearningStatsSchema>;

// ═══════════════════════════════════════════════════════════════
// SM-2 ALGORITHM HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate new SM-2 values after a review
 * @param quality - Quality of recall (0-5)
 * @param easeFactor - Current ease factor
 * @param interval - Current interval in days
 * @param repetitions - Number of successful repetitions
 */
export function calculateSM2(
  quality: number,
  easeFactor: number,
  interval: number,
  repetitions: number
): SM2ReviewResult {
  let newEaseFactor = easeFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  // Calculate new ease factor
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Minimum ease factor is 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }

  // Determine next interval
  if (quality < 3) {
    // Failed recall - reset
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful recall
    newRepetitions = repetitions + 1;

    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    quality,
    newEaseFactor: Math.round(newEaseFactor * 100) / 100,
    newInterval,
    nextReviewDate: nextReviewDate.toISOString(),
    repetitions: newRepetitions,
  };
}

/**
 * Get cards due for review
 */
export function isDue(nextReviewDate: string | undefined): boolean {
  if (!nextReviewDate) return true;
  return new Date(nextReviewDate) <= new Date();
}

/**
 * Get quality description
 */
export function getQualityDescription(quality: number): string {
  switch (quality) {
    case 0:
      return 'Aucun souvenir';
    case 1:
      return "Incorrect, mais reconnu après l'avoir vu";
    case 2:
      return 'Incorrect, mais facile à retenir';
    case 3:
      return 'Correct avec difficulté';
    case 4:
      return 'Correct après hésitation';
    case 5:
      return 'Réponse parfaite';
    default:
      return 'Inconnu';
  }
}

/**
 * Estimate mastery level based on flashcard stats
 */
export function estimateMasteryLevel(
  totalCards: number,
  masteredCards: number,
  averageEaseFactor: number,
  averageAccuracy: number
): number {
  if (totalCards === 0) return 0;

  const masteryRatio = masteredCards / totalCards;
  const easeContribution = Math.min((averageEaseFactor - 1.3) / 1.7, 1); // Normalize to 0-1
  const accuracyContribution = averageAccuracy / 100;

  // Weighted average
  const mastery =
    masteryRatio * 0.4 + // 40% from mastered ratio
    easeContribution * 0.3 + // 30% from ease factor
    accuracyContribution * 0.3; // 30% from accuracy

  return Math.round(mastery * 100);
}
