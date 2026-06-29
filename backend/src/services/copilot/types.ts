/**
 * Copilot — Shared Types
 * Provider-neutral agent config + SSE streaming
 */

// --- Context Types ---

import { TalentContext as BaseTalentContext } from './context';
import { SupportedLanguage } from '../../i18n';

export interface TalentContext extends BaseTalentContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  /** User's preferred language for copilot responses */
  language?: SupportedLanguage;
  /** Dynamically injected skill instructions when a skill trigger matches the user message */
  activeSkillInstructions?: string;
}

export interface OrgContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  organizationId: string;
  organizationName: string;
  role: string;
  /** User's preferred language for copilot responses */
  language?: SupportedLanguage;
  /** Pre-loaded org enrichment (avoids org_stats call) */
  orgSectors?: string[];
  memberCount?: number;
  logoUrl?: string;
  orgCity?: string;
  orgCountry?: string;
  /** Admin's country, used only as explicit organization context */
  country?: string;
  /** Dynamically injected skill instructions when a skill trigger matches the user message */
  activeSkillInstructions?: string;
}

// --- Message Segments Ordered Text/Tool Blocks For Inline Rendering ---

export interface ToolSegmentData {
  callId: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  summary?: string;
  duration?: number;
  status: 'running' | 'success' | 'error';
  error?: string;
}

export interface MessageSegment {
  type: 'text' | 'tool';
  content?: string;
  tool?: ToolSegmentData;
}

// --- Sse Event Types ---

export interface SSETextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface SSEToolStartEvent {
  type: 'tool_start';
  tool: {
    callId: string;
    name: string;
    args?: Record<string, unknown>;
  };
}

export interface SSEToolEndEvent {
  type: 'tool_end';
  tool: {
    callId: string;
    name: string;
    summary?: string;
    result?: unknown;
    duration?: number;
    status: 'success' | 'error';
    error?: string;
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

export interface SSELimitReachedEvent {
  type: 'limit_reached';
  reason: 'max_tools' | 'max_duration' | 'tool_loop' | 'semantic_empty_results' | 'max_tokens';
  message: string;
}

export interface SSEContentCorrectedEvent {
  type: 'content_corrected';
  content: string;
}

export interface SSEAudioReadyEvent {
  type: 'audio_ready';
  audioUrl: string;
  duration: number;
}

export type SSEEvent =
  | SSETextDeltaEvent
  | SSEToolStartEvent
  | SSEToolEndEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSELimitReachedEvent
  | SSEContentCorrectedEvent
  | SSEAudioReadyEvent;

// --- Tool Context Passed To Tool Execute Functions ---

export interface ToolContext {
  talentId: string;
  organizationId?: string;
}
