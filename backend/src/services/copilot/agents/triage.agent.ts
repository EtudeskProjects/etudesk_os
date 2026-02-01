/**
 * Triage Agent
 * Entry point agent that routes requests to the appropriate hub
 */

import { runAgent, AgentInput, AgentOutput, AgentMessage } from './base.agent';
import { TalentContext } from '../ontology/context';
import { detectIntent, shouldRouteToExplorer, shouldRouteToStudy } from '../ontology/behaviors';
import { AgentType } from '../ontology/behaviors';

// ═══════════════════════════════════════════════════════════════
// TRIAGE TOOLS (handoffs only, defined in base.agent)
// ═══════════════════════════════════════════════════════════════

const TRIAGE_TOOLS: string[] = []; // Handoffs are added automatically by base.agent

// ═══════════════════════════════════════════════════════════════
// TRIAGE AGENT
// ═══════════════════════════════════════════════════════════════

export interface TriageAgentInput {
  message: string;
  history: AgentMessage[];
  context: {
    talentId: string;
    talentName?: string;
    talentContext?: TalentContext;
  };
  mode?: 'explore' | 'study'; // If mode is already specified, skip triage
}

export interface TriageAgentOutput extends AgentOutput {
  suggestedMode?: 'explore' | 'study';
  detectedIntents?: string[];
}

/**
 * Quick intent detection without calling the LLM
 * Used for fast routing when intent is clear
 */
export function quickRouting(message: string): 'explore' | 'study' | null {
  const intents = detectIntent(message);

  if (intents.length === 0) {
    return null; // Needs LLM triage
  }

  if (shouldRouteToExplorer(intents) && !shouldRouteToStudy(intents)) {
    return 'explore';
  }

  if (shouldRouteToStudy(intents) && !shouldRouteToExplorer(intents)) {
    return 'study';
  }

  return null; // Ambiguous, needs LLM
}

/**
 * Run the Triage agent
 * Analyzes the request and routes to the appropriate hub
 */
export async function runTriageAgent(input: TriageAgentInput): Promise<TriageAgentOutput> {
  // If mode is already specified, skip triage
  if (input.mode) {
    return {
      content: '',
      suggestedMode: input.mode,
      handoff: {
        targetAgent: input.mode === 'explore' ? 'explorer_hub' : 'study_hub',
        reason: `Mode ${input.mode} spécifié par l'utilisateur`,
      },
    };
  }

  // Try quick routing first
  const quickRoute = quickRouting(input.message);
  if (quickRoute) {
    const intents = detectIntent(input.message);
    return {
      content: '',
      suggestedMode: quickRoute,
      detectedIntents: intents,
      handoff: {
        targetAgent: quickRoute === 'explore' ? 'explorer_hub' : 'study_hub',
        reason: `Intent détecté: ${intents.join(', ')}`,
      },
    };
  }

  // If quick routing fails, use LLM triage
  const result = await runAgent('triage', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, TRIAGE_TOOLS);

  // Determine suggested mode from handoff
  let suggestedMode: 'explore' | 'study' | undefined;
  if (result.handoff) {
    if (result.handoff.targetAgent === 'explorer_hub') {
      suggestedMode = 'explore';
    } else if (result.handoff.targetAgent === 'study_hub') {
      suggestedMode = 'study';
    }
  }

  return {
    ...result,
    suggestedMode,
    detectedIntents: detectIntent(input.message),
  };
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

import { runExplorerHub, runSearchAgent, runWebSearchAgent, runDocumentGeneratorAgent, runDocumentReaderAgent, runAdminAgent, runInvitationAgent, runApplicationAgent, runActivityAgent, runOrgManagerAgent } from './explorer.agent';
import { runStudyHub, runLearnAgent, runQuizAgent, runFlashcardAgent, runCodeAgent, runResourceAgent } from './study.agent';

/**
 * Get the runner function for a specific agent type
 */
function getAgentRunner(agentType: AgentType) {
  const runners: Record<string, (input: any) => Promise<AgentOutput>> = {
    triage: runTriageAgent,
    explorer_hub: runExplorerHub,
    search: runSearchAgent,
    web_search: runWebSearchAgent,
    document_generator: runDocumentGeneratorAgent,
    document_reader: runDocumentReaderAgent,
    admin: runAdminAgent,
    invitation: runInvitationAgent,
    application: runApplicationAgent,
    activity: runActivityAgent,
    org_manager: runOrgManagerAgent,
    study_hub: runStudyHub,
    learn: runLearnAgent,
    quiz: runQuizAgent,
    flashcard: runFlashcardAgent,
    code: runCodeAgent,
    resource: runResourceAgent,
  };
  return runners[agentType];
}

/**
 * Orchestrate a conversation with automatic handoffs
 * Starts with triage and follows handoffs to complete the request
 */
export async function orchestrate(
  message: string,
  history: AgentMessage[],
  context: {
    talentId: string;
    talentName?: string;
    talentContext?: TalentContext;
  },
  mode?: 'explore' | 'study',
  maxHandoffs: number = 3
): Promise<AgentOutput> {
  let currentAgent: AgentType = 'triage';
  let result: AgentOutput;
  let handoffCount = 0;

  // Start with triage or skip to hub if mode is specified
  if (mode === 'explore') {
    currentAgent = 'explorer_hub';
  } else if (mode === 'study') {
    currentAgent = 'study_hub';
  }

  // Run agents with handoffs
  while (handoffCount <= maxHandoffs) {
    const runner = getAgentRunner(currentAgent);
    if (!runner) {
      throw new Error(`Unknown agent type: ${currentAgent}`);
    }

    result = await runner({
      message,
      history,
      context,
      mode,
    });

    // If no handoff, we're done
    if (!result.handoff) {
      return result;
    }

    // Follow the handoff
    currentAgent = result.handoff.targetAgent;
    handoffCount++;

    // If the handoff is to a hub, the next message is still the original
    // If it's to a sub-agent, continue with the same message
  }

  // Max handoffs reached, return last result
  return result!;
}
