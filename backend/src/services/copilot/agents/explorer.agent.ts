/**
 * Explorer Agent
 * Hub agent for discovery: opportunities, communities, spaces, documents
 */

import { runAgent, AgentInput, AgentOutput, AgentMessage } from './base.agent';
import { TalentContext } from '../ontology/context';

// ═══════════════════════════════════════════════════════════════
// EXPLORER HUB TOOLS
// ═══════════════════════════════════════════════════════════════

const EXPLORER_HUB_TOOLS = [
  'get_context',
  'get_talent_profile',
  'get_talent_preferences',
];

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT TOOLS
// ═══════════════════════════════════════════════════════════════

const SEARCH_AGENT_TOOLS = [
  'search_opportunities',
  'search_communities',
  'search_spaces',
  'get_talent_profile',
  'get_talent_preferences',
];

const WEB_SEARCH_AGENT_TOOLS = ['brave_web_search'];

const DOCUMENT_GENERATOR_TOOLS = [
  'generate_pdf',
  'generate_csv',
  'get_talent_profile',
];

const DOCUMENT_READER_TOOLS = [
  'list_documents',
  'read_document',
  'analyze_document',
];

const ADMIN_TOOLS = [
  'check_admin_permissions',
  'list_org_members',
  'get_org_stats',
  'list_org_opportunities',
];

// ═══════════════════════════════════════════════════════════════
// EXPLORER HUB AGENT
// ═══════════════════════════════════════════════════════════════

export interface ExplorerAgentInput {
  message: string;
  history: AgentMessage[];
  context: {
    talentId: string;
    talentName?: string;
    talentContext?: TalentContext;
  };
}

export interface ExplorerAgentOutput extends AgentOutput {
  // Explorer-specific fields can be added here
}

/**
 * Run the Explorer Hub agent
 * This is the main entry point for explore mode
 */
export async function runExplorerHub(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('explorer_hub', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, EXPLORER_HUB_TOOLS);
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Run the Search sub-agent
 * Specialized for searching opportunities, communities, spaces
 */
export async function runSearchAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('search', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, SEARCH_AGENT_TOOLS);
}

/**
 * Run the Web Search sub-agent
 * Specialized for external web searches via Brave
 */
export async function runWebSearchAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('web_search', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, WEB_SEARCH_AGENT_TOOLS);
}

/**
 * Run the Document Generator sub-agent
 * Specialized for generating CVs, letters, exports
 */
export async function runDocumentGeneratorAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('document_generator', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, DOCUMENT_GENERATOR_TOOLS);
}

/**
 * Run the Document Reader sub-agent
 * Specialized for reading and analyzing user documents
 */
export async function runDocumentReaderAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('document_reader', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, DOCUMENT_READER_TOOLS);
}

/**
 * Run the Admin sub-agent
 * Specialized for organization management
 */
export async function runAdminAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('admin', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, ADMIN_TOOLS);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORT (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

export { runExplorerHub as runExplorerAgent };
