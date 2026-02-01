/**
 * Copilot Service
 * Handles all copilot-related API calls
 */

import { api, ApiResponse } from './api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export const COPILOT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
} as const;

export type CopilotMode = (typeof COPILOT_MODES)[keyof typeof COPILOT_MODES];

// Common output types
export const COMMON_OUTPUT_TYPES = {
  TEXT: 'text',
  CONFIRMATION: 'confirmation',
  ERROR: 'error',
  CARD_LIST: 'card_list',
} as const;

// Explorer-specific output types
export const EXPLORER_OUTPUT_TYPES = {
  OPPORTUNITY_LIST: 'opportunity_list',
  COMMUNITY_LIST: 'community_list',
  SPACE_LIST: 'space_list',
  ORGANIZATION_LIST: 'organization_list',
  WEB_SEARCH_RESULTS: 'web_search_results',
  DOCUMENT_GENERATED: 'document_generated',
  DOCUMENT_ANALYSIS: 'document_analysis',
  ADMIN_STATS: 'admin_stats',
  MEMBER_LIST: 'member_list',
} as const;

// Study-specific output types
export const STUDY_OUTPUT_TYPES = {
  FLASHCARD: 'flashcard',
  MINI_QUIZ: 'mini_quiz',
  CODE_EDITOR: 'code_editor',
  DIAGRAM_VIEWER: 'diagram_viewer',
  IMAGE_VIEWER: 'image_viewer',
  YOUTUBE_PLAYER: 'youtube_player',
  WIKIPEDIA_ARTICLE: 'wikipedia_article',
  PROGRESS_REVIEW: 'progress_review',
  TOPIC_OVERVIEW: 'topic_overview',
} as const;

export const OUTPUT_TYPES = {
  ...COMMON_OUTPUT_TYPES,
  ...EXPLORER_OUTPUT_TYPES,
  ...STUDY_OUTPUT_TYPES,
} as const;

export type OutputType = (typeof OUTPUT_TYPES)[keyof typeof OUTPUT_TYPES];

// Card type for card_list output
export interface CopilotCardMetadata {
  location?: string;
  memberCount?: number;
  price?: string;
  [key: string]: unknown;
}

export interface CopilotCard {
  id: string;
  type: 'opportunity' | 'community' | 'space' | 'skill' | 'organization';
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  metadata?: CopilotCardMetadata;
  actions?: Array<{
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }>;
}

export interface CardListOutput {
  cards: CopilotCard[];
  totalCount?: number;
  hasMore?: boolean;
  query?: string;
}

// Skill graph output
export interface SkillNode {
  id: string;
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  progress?: number;
  domain?: string;
  children?: string[];
  isTarget?: boolean;
  isAcquired?: boolean;
}

export interface SkillGraphOutput {
  nodes: SkillNode[];
  edges: Array<{
    from: string;
    to: string;
    type: 'prerequisite' | 'related' | 'parent';
  }>;
  focusSkillId?: string;
  summary?: string;
}

// Quiz output
export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'open_ended';
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
  skillId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizOutput {
  title: string;
  description?: string;
  questions: QuizQuestion[];
  skillId?: string;
  skillName?: string;
  estimatedTime?: number;
}

// Learning path output
export interface LearningStep {
  id: string;
  title: string;
  description: string;
  type: 'lesson' | 'exercise' | 'quiz' | 'project' | 'resource';
  duration?: number;
  resourceUrl?: string;
  skillId?: string;
  completed?: boolean;
  order: number;
}

export interface LearningPathOutput {
  title: string;
  description?: string;
  targetSkill: string;
  currentLevel?: string;
  targetLevel?: string;
  steps: LearningStep[];
  estimatedDuration?: number;
  prerequisites?: string[];
}

// ═══════════════════════════════════════════════════════════════
// STUDY MODE OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════

// Flashcard output (SM-2 spaced repetition)
export interface FlashcardOutput {
  id: string;
  topicId: string;
  topicName: string;
  front: string;
  back: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  hint?: string;
  easinessFactor?: number;
  intervalDays?: number;
  repetitionCount?: number;
  nextReviewDate?: string;
}

// Mini quiz output
export interface MiniQuizOutput {
  topicId?: string;
  topicName?: string;
  questions: QuizQuestion[];
  allowRetry: boolean;
  showExplanations: boolean;
}

// Code editor output
export interface CodeEditorOutput {
  language: string;
  initialCode: string;
  instructions: string;
  expectedOutput?: string;
  hints?: string[];
  topicId?: string;
}

// Diagram viewer output (Mermaid diagrams)
export interface DiagramViewerOutput {
  type: 'flowchart' | 'sequence' | 'class' | 'er' | 'mindmap' | 'timeline';
  code: string;
  title: string;
  description?: string;
}

// Image viewer output
export interface ImageViewerOutput {
  url: string;
  alt: string;
  caption?: string;
  source?: string;
}

// YouTube player output
export interface YouTubePlayerOutput {
  videoId: string;
  title: string;
  channelName?: string;
  startTime?: number;
  endTime?: number;
  description?: string;
}

// Wikipedia article output
export interface WikipediaArticleOutput {
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

// Progress review output
export interface ProgressReviewOutput {
  period: 'day' | 'week' | 'month' | 'all';
  cardsReviewed: number;
  cardsLearned: number;
  accuracy: number;
  streakDays: number;
  topicBreakdown: Array<{
    topicId: string;
    topicName: string;
    masteryLevel: number;
    cardsReviewed: number;
    accuracy: number;
  }>;
  recommendations: string[];
}

// Topic overview output
export interface TopicOverviewOutput {
  id: string;
  name: string;
  description?: string;
  masteryLevel: number;
  totalFlashcards: number;
  dueFlashcards: number;
  relatedTopics: Array<{
    id: string;
    name: string;
  }>;
  suggestedActions: string[];
}

// Union of all output types
export type CopilotOutputData =
  | CardListOutput
  | SkillGraphOutput
  | QuizOutput
  | LearningPathOutput
  | FlashcardOutput
  | MiniQuizOutput
  | CodeEditorOutput
  | DiagramViewerOutput
  | ImageViewerOutput
  | YouTubePlayerOutput
  | WikipediaArticleOutput
  | ProgressReviewOutput
  | TopicOverviewOutput
  | string;

// ═══════════════════════════════════════════════════════════════
// LEARNING TYPES
// ═══════════════════════════════════════════════════════════════

export interface LearningTopic {
  id: string;
  name: string;
  description?: string;
  parentTopicId?: string;
  masteryLevel: number;
  flashcardCount: number;
  dueCount?: number;
  lastStudiedAt?: string;
  createdAt: string;
}

export interface LearningFlashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topic: {
    id: string;
    name: string;
  };
  easinessFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewDate: string;
}

export interface LearningProgress {
  topics: Array<{
    id: string;
    name: string;
    masteryLevel: number;
    flashcardCount: number;
    dueCount: number;
    lastStudiedAt?: string;
  }>;
  totalTopics: number;
  totalFlashcards: number;
  dueFlashcards: number;
  streakDays: number;
  totalStudyTimeMinutes: number;
  lastStudyDate?: string;
}

// Message types
export interface CopilotMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  toolResults?: Array<{ toolCallId: string; result: unknown }>;
  outputType?: OutputType;
  outputData?: CopilotOutputData;
  createdAt: string;
}

// Session types
export interface SessionContext {
  focusEntities?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
  preferences?: {
    sectors?: string[];
    locations?: string[];
    skills?: string[];
    remotePreference?: boolean;
  };
  learningContext?: {
    targetSkills?: string[];
    currentLevel?: string;
    learningStyle?: 'visual' | 'practical' | 'theoretical';
  };
}

export interface CopilotSession {
  id: string;
  talentId: string;
  mode: CopilotMode;
  title?: string;
  context: SessionContext;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title?: string;
  mode: CopilotMode;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
}

// API Response types
export interface ChatResponse {
  sessionId: string;
  message: CopilotMessage;
  context?: SessionContext;
}

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

class CopilotService {
  /**
   * Send a message to the copilot
   * Mode is optional - triage agent will determine if not provided
   */
  async sendMessage(
    message: string,
    mode?: CopilotMode,
    sessionId?: string
  ): Promise<ApiResponse<{ data: ChatResponse }>> {
    return api.post('/api/copilot/chat', {
      message,
      mode,
      sessionId,
    });
  }

  /**
   * List user's copilot sessions
   */
  async listSessions(limit: number = 20): Promise<ApiResponse<{ sessions: SessionSummary[] }>> {
    return api.get('/api/copilot/sessions', { limit });
  }

  /**
   * Create a new session
   */
  async createSession(mode: CopilotMode): Promise<ApiResponse<CopilotSession>> {
    return api.post('/api/copilot/sessions', { mode });
  }

  /**
   * Get session details with messages
   */
  async getSession(
    sessionId: string
  ): Promise<ApiResponse<{ session: CopilotSession; messages: CopilotMessage[] }>> {
    return api.get(`/api/copilot/sessions/${sessionId}`);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return api.delete(`/api/copilot/sessions/${sessionId}`);
  }

  /**
   * Get session messages
   */
  async getSessionMessages(
    sessionId: string,
    limit: number = 50
  ): Promise<ApiResponse<{ messages: CopilotMessage[] }>> {
    return api.get(`/api/copilot/sessions/${sessionId}/messages`, { limit });
  }

  // ═══════════════════════════════════════════════════════════════
  // LEARNING ENDPOINTS (Study Mode)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get learning progress summary
   */
  async getLearningProgress(): Promise<ApiResponse<{ data: LearningProgress }>> {
    return api.get('/api/copilot/learning/progress');
  }

  /**
   * Get due flashcards for review
   */
  async getDueFlashcards(
    topicId?: string,
    limit: number = 20
  ): Promise<ApiResponse<{ data: { flashcards: LearningFlashcard[]; count: number } }>> {
    return api.get('/api/copilot/learning/due', { topicId, limit });
  }

  /**
   * Record a flashcard review
   * Quality scale (SM-2):
   * - 0: Complete blackout
   * - 1: Wrong answer, remembered after seeing
   * - 2: Wrong answer, easy to recall
   * - 3: Correct with difficulty
   * - 4: Correct with hesitation
   * - 5: Perfect response
   */
  async recordFlashcardReview(
    flashcardId: string,
    quality: 0 | 1 | 2 | 3 | 4 | 5
  ): Promise<
    ApiResponse<{
      data: {
        flashcardId: string;
        quality: number;
        newStats: {
          easinessFactor: number;
          intervalDays: number;
          repetitionCount: number;
          nextReviewDate: string;
          lastReviewedAt: string;
        };
      };
    }>
  > {
    return api.post('/api/copilot/learning/review', { flashcardId, quality });
  }

  /**
   * Get user's learning topics
   */
  async getLearningTopics(): Promise<ApiResponse<{ data: { topics: LearningTopic[] } }>> {
    return api.get('/api/copilot/learning/topics');
  }
}

export const copilotService = new CopilotService();
export default copilotService;
