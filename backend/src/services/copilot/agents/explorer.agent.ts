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
  'search_organizations',
  'search_talents',
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
  'get_org_revenue',
];

const INVITATION_TOOLS = [
  'list_my_invitations',
  'respond_to_invitation',
  'send_invitation',
  'list_org_invitations',
];

const APPLICATION_TOOLS = [
  'list_my_applications',
  'apply_to_opportunity',
  'withdraw_application',
  'join_community',
  'list_my_reservations',
  'book_space',
  'list_org_applications',
  'update_application_status',
  'list_membership_requests',
  'respond_to_membership',
  'list_org_reservations',
];

const ACTIVITY_TOOLS = [
  'list_activities',
  'create_activity',
  'edit_activity',
  'pin_activity',
  'comment_on_activity',
  'react_to_activity',
];

const ORG_MANAGER_TOOLS = [
  'check_admin_permissions',
  'create_community',
  'edit_community',
  'create_space',
  'edit_space',
  'create_opportunity',
  'edit_opportunity',
  'get_org_revenue',
  'list_org_members',
  'get_org_stats',
  'list_org_opportunities',
  'list_org_applications',
  'update_application_status',
  'list_membership_requests',
  'respond_to_membership',
  'list_org_reservations',
  'send_invitation',
  'list_org_invitations',
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

/**
 * Run the Invitation sub-agent
 * Specialized for managing invitations
 */
export async function runInvitationAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('invitation', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, INVITATION_TOOLS);
}

/**
 * Run the Application sub-agent
 * Specialized for applications, memberships, reservations
 */
export async function runApplicationAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('application', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, APPLICATION_TOOLS);
}

/**
 * Run the Activity sub-agent
 * Specialized for community activities (posts, comments, reactions)
 */
export async function runActivityAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('activity', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, ACTIVITY_TOOLS);
}

/**
 * Run the Org Manager sub-agent
 * Specialized for organization management (CRUD communities, spaces, opportunities, revenue)
 */
export async function runOrgManagerAgent(input: ExplorerAgentInput): Promise<ExplorerAgentOutput> {
  return runAgent('org_manager', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, ORG_MANAGER_TOOLS);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORT (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

export { runExplorerHub as runExplorerAgent };
