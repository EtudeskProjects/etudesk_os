/**
 * Copilot — Main Exports
 * Native Anthropic SDK + Claude + SSE Streaming
 */

// Agents (return AgentConfig, not Agent)
export { createTalentAgent } from './agents/talent.agent';
export { createOrgAgent } from './agents/organization.agent';

// Tool helper types
export type { ToolDefinition, AgentConfig } from './tools/tool-helper';

// Tools
export { smartSearchTool } from './tools/smart-search.tool';
export { createSqlQueryTool } from './tools/sql-query.tool';
export { youtubeSearchTool } from './tools/youtube-search.tool';
export { analyzeYoutubeVideoTool } from './tools/youtube-analyze.tool';
export { generateDocumentTool, createGenerateDocumentTool } from './tools/generate-document.tool';
export { generateImageTool, createGenerateImageTool } from './tools/generate-image.tool';
export { generateDiagramTool } from './tools/generate-diagram.tool';
export { createFileReaderTool } from './tools/file-read.tool';
export { webSearchAgent, webSearchAsTool } from './tools/web-search.tool';
export { createManageSkillsTool } from './tools/manage-skills.tool';
export { createExecuteActionTool } from './tools/execute-action.tool'; 
export { createCvGenerationTool } from './tools/cv-generation.tool';

// Guardrails
export { inputSafetyGuardrail, runInputGuardrail } from './guardrails/input.guardrail';
export { outputFormatGuardrail } from './guardrails/output.guardrail';

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
  updateSession,
  getSessionMessages,
  COPILOT_MODES,
  type CopilotMode,
  type CopilotSession,
  type CopilotMessage,
} from './session.service';

// Context
export { loadTalentContext } from './context';
export { EXPLORER_CONTEXT_OPTIONS, STUDY_CONTEXT_OPTIONS, ORG_CONTEXT_OPTIONS } from './context-options';

// Run Context
export { createCopilotRunContext, type CopilotRunContext } from './run-context';

// Session Summarizer
export { summarizeHistoryIfNeeded } from './session-summarizer';

// Ontology
export { getOntology, reloadOntology } from './ontology.cache';

// Skills Library
export { loadAllSkillMetadata, getSkillsForMode, getSkillBody, detectSkillFromMessage, reloadSkills } from './skills/skill.loader';
export type { SkillDefinition, SkillMetadata } from './skills/skill.types';

// UEMOA Knowledge
export { getUEMOAKnowledgeBlock, isUEMOACountry, shouldInjectUEMOA } from './uemoa-knowledge';

// DPO Trace Service
export { getWinningTrajectories, invalidateTrajectoryCache } from './trace.service';

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
  SSEAudioReadyEvent,
  ToolContext,
  MessageSegment,
  ToolSegmentData,
} from './types';
