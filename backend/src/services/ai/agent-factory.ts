/**
 * Agent Factory — Centralized creation of one-shot agents
 * Uses @openai/agents SDK for all non-copilot LLM calls
 */

import { Agent } from '@openai/agents';
import { SPACE_GEN_SYSTEM_PROMPT } from './prompts/space-gen.prompt';
import { COMMUNITY_GEN_SYSTEM_PROMPT } from './prompts/community-gen.prompt';
import { OPPORTUNITY_GEN_SYSTEM_PROMPT } from './prompts/opportunity-gen.prompt';
import { RECOMMENDATION_SYSTEM_PROMPT } from './prompts/recommendation.prompt';
import { SESSION_TITLE_SYSTEM_PROMPT } from './prompts/session-utils.prompt';

// ═══════════════════════════════════════════════════════════════
// SPACE GENERATION
// ═══════════════════════════════════════════════════════════════

export function createSpaceGenAgent(): Agent {
  return new Agent({
    name: 'Space Generator',
    model: 'gpt-4.1-nano',
    instructions: SPACE_GEN_SYSTEM_PROMPT,
  });
}

// ═══════════════════════════════════════════════════════════════
// COMMUNITY GENERATION
// ═══════════════════════════════════════════════════════════════

export function createCommunityGenAgent(): Agent {
  return new Agent({
    name: 'Community Generator',
    model: 'gpt-4.1-nano',
    instructions: COMMUNITY_GEN_SYSTEM_PROMPT,
  });
}

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY GENERATION
// ═══════════════════════════════════════════════════════════════

export function createOpportunityGenAgent(): Agent {
  return new Agent({
    name: 'Opportunity Generator',
    model: 'gpt-4.1-nano',
    instructions: OPPORTUNITY_GEN_SYSTEM_PROMPT,
  });
}

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATION
// ═══════════════════════════════════════════════════════════════

export function createRecommendationAgent(): Agent {
  return new Agent({
    name: 'Recommendation Generator',
    model: 'gpt-4.1-nano',
    instructions: RECOMMENDATION_SYSTEM_PROMPT,
  });
}

// ═══════════════════════════════════════════════════════════════
// SESSION UTILS (Title + Suggestions)
// ═══════════════════════════════════════════════════════════════

export function createTitleAgent(): Agent {
  return new Agent({
    name: 'Session Title Generator',
    model: 'gpt-4.1-nano',
    instructions: SESSION_TITLE_SYSTEM_PROMPT,
  });
}

export function createSuggestionsAgent(systemPrompt: string): Agent {
  return new Agent({
    name: 'Suggestions Generator',
    model: 'gpt-4.1-nano',
    instructions: systemPrompt,
  });
}
