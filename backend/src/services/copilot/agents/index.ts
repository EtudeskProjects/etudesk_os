/**
 * Copilot Agents Index
 * Central export for all agents
 */

// Base agent infrastructure
export * from './base.agent';

// Triage agent and orchestrator
export * from './triage.agent';
export { orchestrate, quickRouting, runTriageAgent } from './triage.agent';

// Explorer hub and sub-agents
export * from './explorer.agent';
export {
  runExplorerHub,
  runExplorerAgent, // Legacy alias
  runSearchAgent,
  runWebSearchAgent,
  runDocumentGeneratorAgent,
  runDocumentReaderAgent,
  runAdminAgent,
} from './explorer.agent';

// Study hub and sub-agents
export * from './study.agent';
export {
  runStudyHub,
  runStudyAgent, // Legacy alias
  runLearnAgent,
  runQuizAgent,
  runFlashcardAgent,
  runCodeAgent,
  runResourceAgent,
} from './study.agent';

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

import { AgentMessage, AgentOutput } from './base.agent';
import { orchestrate } from './triage.agent';
import { TalentContext } from '../ontology/context';

/**
 * Main entry point for running the copilot
 * Handles routing and orchestration automatically
 */
export async function runCopilot(
  message: string,
  history: AgentMessage[],
  context: {
    talentId: string;
    talentName?: string;
    talentContext?: TalentContext;
  },
  mode?: 'explore' | 'study'
): Promise<AgentOutput> {
  return orchestrate(message, history, context, mode);
}
