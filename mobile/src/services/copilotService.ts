/**
 * Copilot Service
 * Handles all copilot-related API calls
 */

import { api, ApiResponse } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

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

  // ═══════════════════════════════════════════════════════════════
  // SSE STREAMING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send a message with SSE streaming
   * Returns an AbortController to cancel the stream
   */
  sendMessageStream(
    message: string,
    mode: CopilotMode,
    sessionId: string | undefined,
    callbacks: {
      onTextDelta: (delta: string) => void;
      onToolStart: (tool: { name: string; args?: Record<string, unknown> }) => void;
      onToolEnd: (tool: { name: string; result?: unknown; duration?: number }) => void;
      onDone: (sessionId: string) => void;
      onError: (error: string) => void;
    },
    organizationId?: string
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const url = `${API_CONFIG.BASE_URL}/api/copilot/chat`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ message, mode, sessionId, organizationId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          callbacks.onError(errorData.error || `Erreur ${response.status}`);
          return;
        }

        if (!response.body) {
          callbacks.onError('Streaming non supporté');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events (data: {...}\n\n)
          const lines = buffer.split('\n');
          buffer = '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));

                switch (event.type) {
                  case 'text_delta':
                    callbacks.onTextDelta(event.delta);
                    break;
                  case 'tool_start':
                    callbacks.onToolStart(event.tool);
                    break;
                  case 'tool_end':
                    callbacks.onToolEnd(event.tool);
                    break;
                  case 'done':
                    callbacks.onDone(event.sessionId);
                    break;
                  case 'error':
                    callbacks.onError(event.error);
                    break;
                }
              } catch {
                // Incomplete JSON, add back to buffer
                buffer = lines.slice(i).join('\n');
                break;
              }
            } else if (line !== '' && !line.startsWith(':')) {
              // Non-empty non-comment line, keep in buffer
              buffer += line + '\n';
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          callbacks.onError(error.message || 'Erreur de connexion');
        }
      }
    })();

    return controller;
  }

  /**
   * Get prompt suggestions
   */
  async getSuggestions(mode: CopilotMode): Promise<string[]> {
    try {
      const response = await api.get('/api/copilot/suggestions', { mode });
      return (response.data as any)?.suggestions || [];
    } catch {
      return [];
    }
  }
}

export const copilotService = new CopilotService();
export default copilotService;
