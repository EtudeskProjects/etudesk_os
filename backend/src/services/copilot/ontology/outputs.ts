/**
 * Copilot Output Types
 * Defines structured output types for each mode
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// COMMON OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════

export const COMMON_OUTPUT_TYPES = {
  TEXT: 'text',
  ERROR: 'error',
  CONFIRMATION: 'confirmation',
} as const;

// ═══════════════════════════════════════════════════════════════
// EXPLORER OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════

export const EXPLORER_OUTPUT_TYPES = {
  // Search results
  OPPORTUNITY_LIST: 'opportunity_list',
  COMMUNITY_LIST: 'community_list',
  SPACE_LIST: 'space_list',
  ORGANIZATION_LIST: 'organization_list',
  WEB_SEARCH_RESULTS: 'web_search_results',

  // Document outputs
  DOCUMENT_DOWNLOAD: 'document_download',
  DOCUMENT_PREVIEW: 'document_preview',
  DOCUMENT_ANALYSIS: 'document_analysis',

  // Admin outputs
  MEMBER_LIST: 'member_list',
  ORG_STATS: 'org_stats',

  // Navigation
  NAVIGATION_ACTION: 'navigation_action',
} as const;

// ═══════════════════════════════════════════════════════════════
// STUDY OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════

export const STUDY_OUTPUT_TYPES = {
  // Learning content
  FLASHCARD: 'study_flashcard',
  MINI_QUIZ: 'study_mini_quiz',
  CODE_EDITOR: 'study_code_editor',
  DIAGRAM_VIEWER: 'study_diagram_viewer',
  IMAGE_VIEWER: 'study_image_viewer',
  YOUTUBE_PLAYER: 'study_youtube_player',
  WIKIPEDIA_ARTICLE: 'study_wikipedia_article',

  // Progress
  PROGRESS_REVIEW: 'study_progress_review',
  DUE_CARDS: 'study_due_cards',
} as const;

export type CommonOutputType = (typeof COMMON_OUTPUT_TYPES)[keyof typeof COMMON_OUTPUT_TYPES];
export type ExplorerOutputType = (typeof EXPLORER_OUTPUT_TYPES)[keyof typeof EXPLORER_OUTPUT_TYPES];
export type StudyOutputType = (typeof STUDY_OUTPUT_TYPES)[keyof typeof STUDY_OUTPUT_TYPES];
export type OutputType = CommonOutputType | ExplorerOutputType | StudyOutputType;

// Combined constant for all output types
export const OUTPUT_TYPES = {
  ...COMMON_OUTPUT_TYPES,
  ...EXPLORER_OUTPUT_TYPES,
  ...STUDY_OUTPUT_TYPES,
} as const;

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS - COMMON
// ═══════════════════════════════════════════════════════════════

export const TextOutputSchema = z.object({
  type: z.literal(COMMON_OUTPUT_TYPES.TEXT),
  content: z.string(),
  markdown: z.boolean().default(true),
});

export const ErrorOutputSchema = z.object({
  type: z.literal(COMMON_OUTPUT_TYPES.ERROR),
  message: z.string(),
  code: z.string().optional(),
  recoverable: z.boolean().default(true),
});

export const ConfirmationOutputSchema = z.object({
  type: z.literal(COMMON_OUTPUT_TYPES.CONFIRMATION),
  title: z.string(),
  message: z.string(),
  actionLabel: z.string(),
  actionType: z.enum(['apply', 'join', 'reserve', 'download', 'delete', 'other']),
  actionParams: z.record(z.string(), z.unknown()).optional(),
});

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS - EXPLORER
// ═══════════════════════════════════════════════════════════════

// Base card schema
const BaseCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

// Opportunity card
export const OpportunityCardSchema = BaseCardSchema.extend({
  type: z.literal('opportunity'),
  opportunityType: z.enum([
    'EMPLOYMENT',
    'INTERNSHIP',
    'FREELANCE',
    'APPRENTICESHIP',
    'VOLUNTEER',
    'PROJECT',
    'OTHER',
  ]),
  organization: z.string().optional(),
  location: z.string().optional(),
  isRemote: z.boolean().optional(),
  salary: z.string().optional(),
  deadline: z.string().optional(),
  matchScore: z.number().min(0).max(100).optional(),
  matchReasons: z.array(z.string()).optional(),
});

export const OpportunityListOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.OPPORTUNITY_LIST),
  opportunities: z.array(OpportunityCardSchema),
  totalCount: z.number(),
  query: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  hasMore: z.boolean().default(false),
});

// Community card
export const CommunityCardSchema = BaseCardSchema.extend({
  type: z.literal('community'),
  memberCount: z.number().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(true),
  isMember: z.boolean().default(false),
});

export const CommunityListOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.COMMUNITY_LIST),
  communities: z.array(CommunityCardSchema),
  totalCount: z.number(),
  query: z.string().optional(),
  hasMore: z.boolean().default(false),
});

// Space card
export const SpaceCardSchema = BaseCardSchema.extend({
  type: z.literal('space'),
  spaceType: z.enum(['OFFICE', 'MEETING_ROOM', 'COWORKING', 'EVENT_SPACE', 'TRAINING_ROOM', 'OTHER']),
  location: z.string(),
  capacity: z.number().optional(),
  pricePerHour: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  availability: z.string().optional(),
});

export const SpaceListOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.SPACE_LIST),
  spaces: z.array(SpaceCardSchema),
  totalCount: z.number(),
  query: z.string().optional(),
  hasMore: z.boolean().default(false),
});

// Organization card
export const OrganizationCardSchema = BaseCardSchema.extend({
  type: z.literal('organization'),
  sector: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  opportunityCount: z.number().optional(),
});

export const OrganizationListOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.ORGANIZATION_LIST),
  organizations: z.array(OrganizationCardSchema),
  totalCount: z.number(),
  query: z.string().optional(),
  hasMore: z.boolean().default(false),
});

// Web search results
export const WebSearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  favicon: z.string().optional(),
});

export const WebSearchResultsOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.WEB_SEARCH_RESULTS),
  query: z.string(),
  results: z.array(WebSearchResultSchema),
  totalResults: z.number().optional(),
});

// Document outputs
export const DocumentDownloadOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.DOCUMENT_DOWNLOAD),
  filename: z.string(),
  format: z.enum(['pdf', 'docx', 'csv', 'xlsx']),
  downloadUrl: z.string(),
  sizeBytes: z.number().optional(),
  expiresAt: z.string().optional(),
});

export const DocumentPreviewOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.DOCUMENT_PREVIEW),
  documentId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  previewUrl: z.string(),
  extractedData: z.record(z.string(), z.unknown()).optional(),
});

export const DocumentAnalysisOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.DOCUMENT_ANALYSIS),
  documentId: z.string(),
  filename: z.string(),
  analysis: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    skills: z.array(z.string()).optional(),
    experience: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  }),
});

// Admin outputs
export const MemberCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
  avatarUrl: z.string().optional(),
});

export const MemberListOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.MEMBER_LIST),
  organizationId: z.string(),
  organizationName: z.string(),
  members: z.array(MemberCardSchema),
  totalCount: z.number(),
});

export const OrgStatsOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.ORG_STATS),
  organizationId: z.string(),
  organizationName: z.string(),
  stats: z.object({
    memberCount: z.number(),
    opportunityCount: z.number(),
    applicationCount: z.number(),
    activeOpportunities: z.number(),
    viewsThisMonth: z.number().optional(),
    applicationsThisMonth: z.number().optional(),
  }),
});

// Navigation action
export const NavigationActionOutputSchema = z.object({
  type: z.literal(EXPLORER_OUTPUT_TYPES.NAVIGATION_ACTION),
  action: z.enum(['view', 'apply', 'join', 'reserve', 'contact']),
  targetType: z.enum(['opportunity', 'community', 'space', 'organization', 'profile']),
  targetId: z.string(),
  targetName: z.string(),
  deepLink: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS - STUDY
// ═══════════════════════════════════════════════════════════════

// Flashcard
export const FlashcardOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.FLASHCARD),
  id: z.string().optional(), // If already saved
  topicId: z.string().optional(),
  front: z.string(),
  back: z.string(),
  hint: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string()).optional(),
  // Review state (if reviewing)
  isReview: z.boolean().default(false),
  dueDate: z.string().optional(),
  reviewCount: z.number().optional(),
});

// Mini Quiz
export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionType: z.enum(['multiple_choice', 'true_false', 'fill_blank', 'code']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.number(), z.array(z.string())]),
  explanation: z.string().optional(),
  codeLanguage: z.string().optional(), // For code questions
  codeTemplate: z.string().optional(),
});

export const MiniQuizOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.MINI_QUIZ),
  id: z.string().optional(),
  topicId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  questions: z.array(QuizQuestionSchema),
  timeLimit: z.number().optional(), // seconds
  passingScore: z.number().default(70), // percentage
});

// Code Editor
export const CodeEditorOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.CODE_EDITOR),
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
    'json',
    'markdown',
  ]),
  title: z.string(),
  description: z.string().optional(),
  initialCode: z.string(),
  solution: z.string().optional(),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  hints: z.array(z.string()).optional(),
  readOnly: z.boolean().default(false),
});

// Diagram Viewer
export const DiagramViewerOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.DIAGRAM_VIEWER),
  diagramType: z.enum(['mermaid', 'svg', 'image']),
  title: z.string(),
  description: z.string().optional(),
  content: z.string(), // Mermaid code or image URL
  caption: z.string().optional(),
});

// Image Viewer
export const ImageViewerOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.IMAGE_VIEWER),
  imageUrl: z.string(),
  altText: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  zoomable: z.boolean().default(true),
});

// YouTube Player
export const YouTubePlayerOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.YOUTUBE_PLAYER),
  videoId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.number().optional(), // seconds
  endTime: z.number().optional(),
  keyMoments: z
    .array(
      z.object({
        time: z.number(),
        label: z.string(),
      })
    )
    .optional(),
});

// Wikipedia Article
export const WikipediaArticleOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.WIKIPEDIA_ARTICLE),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  imageUrl: z.string().optional(),
  sections: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  relatedTopics: z.array(z.string()).optional(),
});

// Progress Review
export const ProgressReviewOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.PROGRESS_REVIEW),
  period: z.enum(['today', 'week', 'month', 'all']),
  stats: z.object({
    topicsStudied: z.number(),
    cardsReviewed: z.number(),
    quizzesTaken: z.number(),
    averageScore: z.number(),
    streakDays: z.number(),
    totalStudyTime: z.number(), // minutes
  }),
  recentTopics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      progress: z.number(), // 0-100
      lastStudied: z.string(),
    })
  ),
  recommendations: z.array(z.string()).optional(),
});

// Due Cards
export const DueCardsOutputSchema = z.object({
  type: z.literal(STUDY_OUTPUT_TYPES.DUE_CARDS),
  totalDue: z.number(),
  byTopic: z.array(
    z.object({
      topicId: z.string(),
      topicName: z.string(),
      dueCount: z.number(),
    })
  ),
  nextCard: FlashcardOutputSchema.optional(),
});

// ═══════════════════════════════════════════════════════════════
// UNION TYPES FOR VALIDATION
// ═══════════════════════════════════════════════════════════════

export const ExplorerOutputSchema = z.discriminatedUnion('type', [
  OpportunityListOutputSchema,
  CommunityListOutputSchema,
  SpaceListOutputSchema,
  OrganizationListOutputSchema,
  WebSearchResultsOutputSchema,
  DocumentDownloadOutputSchema,
  DocumentPreviewOutputSchema,
  DocumentAnalysisOutputSchema,
  MemberListOutputSchema,
  OrgStatsOutputSchema,
  NavigationActionOutputSchema,
]);

export const StudyOutputSchema = z.discriminatedUnion('type', [
  FlashcardOutputSchema,
  MiniQuizOutputSchema,
  CodeEditorOutputSchema,
  DiagramViewerOutputSchema,
  ImageViewerOutputSchema,
  YouTubePlayerOutputSchema,
  WikipediaArticleOutputSchema,
  ProgressReviewOutputSchema,
  DueCardsOutputSchema,
]);

export const CommonOutputSchema = z.discriminatedUnion('type', [
  TextOutputSchema,
  ErrorOutputSchema,
  ConfirmationOutputSchema,
]);

// ═══════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════

export type TextOutput = z.infer<typeof TextOutputSchema>;
export type ErrorOutput = z.infer<typeof ErrorOutputSchema>;
export type ConfirmationOutput = z.infer<typeof ConfirmationOutputSchema>;

// Explorer types
export type OpportunityCard = z.infer<typeof OpportunityCardSchema>;
export type OpportunityListOutput = z.infer<typeof OpportunityListOutputSchema>;
export type CommunityCard = z.infer<typeof CommunityCardSchema>;
export type CommunityListOutput = z.infer<typeof CommunityListOutputSchema>;
export type SpaceCard = z.infer<typeof SpaceCardSchema>;
export type SpaceListOutput = z.infer<typeof SpaceListOutputSchema>;
export type OrganizationCard = z.infer<typeof OrganizationCardSchema>;
export type OrganizationListOutput = z.infer<typeof OrganizationListOutputSchema>;
export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;
export type WebSearchResultsOutput = z.infer<typeof WebSearchResultsOutputSchema>;
export type DocumentDownloadOutput = z.infer<typeof DocumentDownloadOutputSchema>;
export type DocumentPreviewOutput = z.infer<typeof DocumentPreviewOutputSchema>;
export type DocumentAnalysisOutput = z.infer<typeof DocumentAnalysisOutputSchema>;
export type MemberCard = z.infer<typeof MemberCardSchema>;
export type MemberListOutput = z.infer<typeof MemberListOutputSchema>;
export type OrgStatsOutput = z.infer<typeof OrgStatsOutputSchema>;
export type NavigationActionOutput = z.infer<typeof NavigationActionOutputSchema>;
export type ExplorerOutput = z.infer<typeof ExplorerOutputSchema>;

// Study types
export type FlashcardOutput = z.infer<typeof FlashcardOutputSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type MiniQuizOutput = z.infer<typeof MiniQuizOutputSchema>;
export type CodeEditorOutput = z.infer<typeof CodeEditorOutputSchema>;
export type DiagramViewerOutput = z.infer<typeof DiagramViewerOutputSchema>;
export type ImageViewerOutput = z.infer<typeof ImageViewerOutputSchema>;
export type YouTubePlayerOutput = z.infer<typeof YouTubePlayerOutputSchema>;
export type WikipediaArticleOutput = z.infer<typeof WikipediaArticleOutputSchema>;
export type ProgressReviewOutput = z.infer<typeof ProgressReviewOutputSchema>;
export type DueCardsOutput = z.infer<typeof DueCardsOutputSchema>;
export type StudyOutput = z.infer<typeof StudyOutputSchema>;

export type CommonOutput = z.infer<typeof CommonOutputSchema>;
export type CopilotOutput = CommonOutput | ExplorerOutput | StudyOutput;

// OutputData is the generic type for any output data
export type OutputData = CopilotOutput | unknown;

// Diagram output alias (for exports)
export type DiagramOutput = DiagramViewerOutput;
export type YouTubeOutput = YouTubePlayerOutput;
export type WikipediaOutput = WikipediaArticleOutput;

// ═══════════════════════════════════════════════════════════════
// OUTPUT HELPERS
// ═══════════════════════════════════════════════════════════════

export function isExplorerOutput(output: CopilotOutput): output is ExplorerOutput {
  return Object.values(EXPLORER_OUTPUT_TYPES).includes(output.type as ExplorerOutputType);
}

export function isStudyOutput(output: CopilotOutput): output is StudyOutput {
  return Object.values(STUDY_OUTPUT_TYPES).includes(output.type as StudyOutputType);
}

export function isCommonOutput(output: CopilotOutput): output is CommonOutput {
  return Object.values(COMMON_OUTPUT_TYPES).includes(output.type as CommonOutputType);
}
