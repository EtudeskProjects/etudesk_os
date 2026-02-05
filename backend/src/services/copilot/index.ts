/**
 * Copilot — Main Exports
 * OpenAI Agents SDK + GPT-4o + SSE Streaming
 */

// Agents
export { createTalentAgent } from './agents/talent.agent';
export { createOrgAgent } from './agents/organization.agent';

// Tools
export { vectorQueryTool } from './tools/vector-query.tool';
export { createSqlQueryTool } from './tools/sql-query.tool';
export { youtubeSearchTool } from './tools/youtube-search.tool';
export { generateDocumentTool } from './tools/generate-document.tool';
export { generateImageTool } from './tools/generate-image.tool';
export { generateDiagramTool } from './tools/generate-diagram.tool';
export { createFileReaderAgent } from './tools/file-read.tool';
export { webSearchAgent } from './tools/web-search.tool';

// Prompts
export { buildTalentExplorerPrompt } from './prompts/talent-explorer.prompt';
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
export { loadTalentContext, EXPLORER_CONTEXT_OPTIONS } from './context';

// Ontology
export { getOntology, reloadOntology } from './ontology.cache';

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
  SSELimitReachedEvent,
  ToolContext,
  MessageSegment,
  ToolSegmentData,
} from './types';
