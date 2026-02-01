/**
 * Copilot — Shared Types
 * OpenAI Agents SDK + GPT-5 + SSE Streaming
 */

// ═══════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════

export interface TalentContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  profile: {
    firstName: string;
    lastName: string;
    headline?: string;
    city?: string;
    country?: string;
    availabilityStatus?: string;
    remotePreference?: string;
    skills: Array<{ name: string; level?: string }>;
    languages: Array<{ language: string; level: string }>;
  };
  documents?: {
    totalCount: number;
    hasCV: boolean;
    hasDiplomas: boolean;
  };
  applications?: {
    totalCount: number;
    activeCount: number;
  };
  memberships?: {
    totalCount: number;
  };
  reservations?: {
    totalCount: number;
    upcomingCount: number;
  };
  invitations?: {
    pendingCount: number;
  };
  organizations?: {
    isOrgAdmin: boolean;
    adminOfCount: number;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      role: string;
    }>;
  };
  learning?: {
    totalTopics: number;
    totalFlashcards: number;
    dueFlashcards: number;
    streakDays: number;
  };
  graph?: {
    isGraphAvailable: boolean;
    skillGaps?: Array<{ skillName: string; priority: string }>;
    suggestedSkills?: Array<{ skillName: string; reason: string }>;
  };
}

export interface OrgContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

// ═══════════════════════════════════════════════════════════════
// SSE EVENT TYPES
// ═══════════════════════════════════════════════════════════════

export interface SSETextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface SSEToolStartEvent {
  type: 'tool_start';
  tool: {
    name: string;
    args?: Record<string, unknown>;
  };
}

export interface SSEToolEndEvent {
  type: 'tool_end';
  tool: {
    name: string;
    result?: unknown;
    duration?: number;
  };
}

export interface SSEDoneEvent {
  type: 'done';
  sessionId: string;
}

export interface SSEErrorEvent {
  type: 'error';
  error: string;
}

export type SSEEvent =
  | SSETextDeltaEvent
  | SSEToolStartEvent
  | SSEToolEndEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// ═══════════════════════════════════════════════════════════════
// TOOL CONTEXT (passed to tool execute functions)
// ═══════════════════════════════════════════════════════════════

export interface ToolContext {
  talentId: string;
  organizationId?: string;
}
