/**
 * Study Agent
 * Hub agent for learning: flashcards, quizzes, exercises, resources
 */

import { runAgent, AgentInput, AgentOutput, AgentMessage } from './base.agent';
import { TalentContext } from '../ontology/context';

// ═══════════════════════════════════════════════════════════════
// STUDY HUB TOOLS
// ═══════════════════════════════════════════════════════════════

const STUDY_HUB_TOOLS = [
  'get_context',
  'get_progress',
  'get_due_cards',
];

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT TOOLS
// ═══════════════════════════════════════════════════════════════

const LEARN_AGENT_TOOLS = [
  'create_flashcard',
  'create_topic',
  'get_progress',
  'search_wikipedia',
  'search_youtube',
  'generate_diagram',
];

const QUIZ_AGENT_TOOLS = [
  'create_quiz',
  'evaluate_quiz_answer',
  'create_flashcard',
  'get_progress',
];

const FLASHCARD_AGENT_TOOLS = [
  'get_due_cards',
  'record_review',
  'create_flashcard',
  'create_topic',
  'get_progress',
];

const CODE_AGENT_TOOLS = [
  'create_flashcard',
  'generate_diagram',
];

const RESOURCE_AGENT_TOOLS = [
  'search_youtube',
  'search_wikipedia',
  'generate_diagram',
  'brave_web_search',
];

// ═══════════════════════════════════════════════════════════════
// STUDY HUB AGENT
// ═══════════════════════════════════════════════════════════════

export interface StudyAgentInput {
  message: string;
  history: AgentMessage[];
  context: {
    talentId: string;
    talentName?: string;
    talentContext?: TalentContext;
  };
}

export interface StudyAgentOutput extends AgentOutput {
  // Study-specific fields can be added here
}

/**
 * Run the Study Hub agent
 * This is the main entry point for study mode
 */
export async function runStudyHub(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('study_hub', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, STUDY_HUB_TOOLS);
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Run the Learn sub-agent
 * Specialized for explaining concepts and teaching
 */
export async function runLearnAgent(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('learn', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, LEARN_AGENT_TOOLS);
}

/**
 * Run the Quiz sub-agent
 * Specialized for creating and evaluating quizzes
 */
export async function runQuizAgent(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('quiz', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, QUIZ_AGENT_TOOLS);
}

/**
 * Run the Flashcard sub-agent
 * Specialized for spaced repetition and reviews
 */
export async function runFlashcardAgent(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('flashcard', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, FLASHCARD_AGENT_TOOLS);
}

/**
 * Run the Code sub-agent
 * Specialized for programming exercises
 */
export async function runCodeAgent(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('code', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, CODE_AGENT_TOOLS);
}

/**
 * Run the Resource sub-agent
 * Specialized for finding learning resources
 */
export async function runResourceAgent(input: StudyAgentInput): Promise<StudyAgentOutput> {
  return runAgent('resource', {
    message: input.message,
    history: input.history,
    context: {
      talentId: input.context.talentId,
      talentContext: input.context.talentContext,
    },
  }, RESOURCE_AGENT_TOOLS);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORT (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

export { runStudyHub as runStudyAgent };
