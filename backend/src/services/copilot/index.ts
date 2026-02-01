/**
 * Copilot — Main Exports
 * OpenAI Agents SDK + GPT-5 + SSE Streaming
 */

// Agents
export { createTalentAgent } from './agents/talent.agent';
export { createOrgAgent } from './agents/organization.agent';

// Tools
export { vectorQueryTool } from './tools/vector-query.tool';
export { graphQueryTool } from './tools/graph-query.tool';
export { sqlQueryTool } from './tools/sql-query.tool';
export { youtubeSearchTool } from './tools/youtube-search.tool';

// Prompts
export { buildTalentExplorerPrompt } from './prompts/talent-explorer.prompt';
export { buildTalentStudyPrompt } from './prompts/talent-study.prompt';
export { buildOrgExplorerPrompt } from './prompts/org-explorer.prompt';

// SSE
export {
  initSSE,
  sendSSE,
  runAgentWithSSE,
  generateSessionTitle,
  generateSuggestions,
} from './stream/sse.handler';

// Session management
export {
  copilotService,
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSessionMessages,
  COPILOT_MODES,
  type CopilotMode,
  type CopilotSession,
  type CopilotMessage,
} from './session.service';

// Context
export { loadTalentContext, EXPLORER_CONTEXT_OPTIONS, STUDY_CONTEXT_OPTIONS } from './context';

// Types
export type {
  TalentContext,
  OrgContext,
  SSEEvent,
  SSETextDeltaEvent,
  SSEToolStartEvent,
  SSEToolEndEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  ToolContext,
} from './types';
