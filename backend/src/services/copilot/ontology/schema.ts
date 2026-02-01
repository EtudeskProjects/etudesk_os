/**
 * Copilot Ontology Schema
 * Main schema file - re-exports and combines all ontology modules
 */

import { z } from 'zod';

// Re-export from sub-modules (selective to avoid conflicts)
export * from './modes';
export {
  // All output types constant
  OUTPUT_TYPES,
  // Grouped output types
  COMMON_OUTPUT_TYPES,
  EXPLORER_OUTPUT_TYPES,
  STUDY_OUTPUT_TYPES,
  // Type aliases
  type OutputType,
  type OutputData,
  // Schemas and types (excluding duplicates)
  OpportunityCardSchema,
  CommunityCardSchema,
  SpaceCardSchema,
  OrganizationCardSchema,
  OpportunityListOutputSchema,
  CommunityListOutputSchema,
  SpaceListOutputSchema,
  FlashcardOutputSchema,
  MiniQuizOutputSchema,
  CodeEditorOutputSchema,
  DiagramViewerOutputSchema,
  YouTubePlayerOutputSchema,
  WikipediaArticleOutputSchema,
  ProgressReviewOutputSchema,
  type OpportunityCard,
  type CommunityCard,
  type SpaceCard,
  type OrganizationCard,
  type OpportunityListOutput,
  type CommunityListOutput,
  type SpaceListOutput,
  type FlashcardOutput,
  type MiniQuizOutput,
  type CodeEditorOutput,
  type DiagramOutput,
  type YouTubeOutput,
  type WikipediaOutput,
  type ProgressReviewOutput,
} from './outputs';
export * from './context';
export {
  // Learning types (selective to avoid QuizQuestion conflict)
  SM2_QUALITY,
  calculateSM2,
  isDue,
  getQualityDescription,
  estimateMasteryLevel,
  FlashcardSchema,
  FlashcardDifficultySchema,
  LearningTopicSchema,
  LearningSessionSchema,
  LearningPreferencesSchema,
  LearningStatsSchema,
  QuizSchema,
  QuizResultSchema,
  CodeExerciseSchema,
  type SM2Quality,
  type SM2ReviewResult,
  type Flashcard,
  type FlashcardDifficulty,
  type LearningTopic,
  type LearningSession,
  type LearningPreferences,
  type LearningStats,
  type Quiz,
  type QuizResult,
  type CodeExercise,
} from './learning';

// ═══════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const;

export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface CopilotMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  outputType?: string;
  outputData?: unknown;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// SESSION TYPES
// ═══════════════════════════════════════════════════════════════

export interface SessionContext {
  // Current focus entities
  focusEntities?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;

  // User preferences detected during conversation
  preferences?: {
    sectors?: string[];
    locations?: string[];
    skills?: string[];
    remotePreference?: boolean;
  };

  // Learning context (study mode)
  learningContext?: {
    currentTopicId?: string;
    currentTopicName?: string;
    activeFlashcardId?: string;
    activeQuizId?: string;
    sessionGoal?: string;
  };

  // Admin context
  adminContext?: {
    activeOrganizationId?: string;
    activeOrganizationName?: string;
    permissions?: string[];
  };

  // Last loaded talent context summary
  lastTalentContext?: {
    hasProfile: boolean;
    hasKYC: boolean;
    documentCount: number;
    learningTopicsCount: number;
  };
}

export interface CopilotSession {
  id: string;
  talentId: string;
  mode: string;
  title?: string;
  context: SessionContext;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ═══════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface ChatRequest {
  sessionId?: string;
  message: string;
  mode: string;
  // Optional file attachments for document-related queries
  attachmentIds?: string[];
}

export interface ChatResponse {
  sessionId: string;
  message: CopilotMessage;
  context?: SessionContext;
  // Structured output for rich UI rendering
  output?: {
    type: string;
    data: unknown;
  };
}

export interface SessionListResponse {
  sessions: Array<{
    id: string;
    title?: string;
    mode: string;
    lastMessageAt?: string;
    createdAt: string;
    messageCount: number;
  }>;
  total: number;
}

export interface SessionDetailResponse {
  session: CopilotSession;
  messages: CopilotMessage[];
}

// ═══════════════════════════════════════════════════════════════
// AGENT CONFIG TYPES
// ═══════════════════════════════════════════════════════════════

export interface AgentConfig {
  name: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools: string[];
  systemPrompt: string;
}

export interface HandoffConfig {
  from: string;
  to: string;
  condition: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS FOR VALIDATION
// ═══════════════════════════════════════════════════════════════

export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  mode: z.enum(['explore', 'study']),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export const SessionContextSchema = z.object({
  focusEntities: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        name: z.string().optional(),
      })
    )
    .optional(),
  preferences: z
    .object({
      sectors: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
      remotePreference: z.boolean().optional(),
    })
    .optional(),
  learningContext: z
    .object({
      currentTopicId: z.string().optional(),
      currentTopicName: z.string().optional(),
      activeFlashcardId: z.string().optional(),
      activeQuizId: z.string().optional(),
      sessionGoal: z.string().optional(),
    })
    .optional(),
  adminContext: z
    .object({
      activeOrganizationId: z.string().optional(),
      activeOrganizationName: z.string().optional(),
      permissions: z.array(z.string()).optional(),
    })
    .optional(),
});

export const CopilotMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.record(z.string(), z.unknown()),
      })
    )
    .optional(),
  toolResults: z
    .array(
      z.object({
        toolCallId: z.string(),
        result: z.unknown(),
        error: z.string().optional(),
      })
    )
    .optional(),
  outputType: z.string().optional(),
  outputData: z.unknown().optional(),
  createdAt: z.string(),
});
