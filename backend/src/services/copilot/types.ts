/**
 * Copilot — Shared Types
 * OpenAI Agents SDK + GPT-4.1 + SSE Streaming
 */

// --- Context Types ---

import { TalentContext as BaseTalentContext } from './context';

export interface TalentContext extends BaseTalentContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  /** User's preferred language for copilot responses */
  language?: 'fr' | 'en';
}

export interface OrgContext {
  talentId: string;
  talentName: string;
  vectorStoreId?: string;
  organizationId: string;
  organizationName: string;
  role: string;
  /** User's preferred language for copilot responses */
  language?: 'fr' | 'en';
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
  reason: 'max_tools' | 'max_duration';
  message: string;
}

export interface SSEContentCorrectedEvent {
  type: 'content_corrected';
  content: string;
}

export type SSEEvent =
  | SSETextDeltaEvent
  | SSEToolStartEvent
  | SSEToolEndEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSELimitReachedEvent
  | SSEContentCorrectedEvent;

// --- Tool Context Passed To Tool Execute Functions ---

export interface ToolContext {
  talentId: string;
  organizationId?: string;
}
