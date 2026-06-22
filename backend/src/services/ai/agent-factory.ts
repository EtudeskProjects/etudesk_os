/**
 * Agent Factory — Centralized creation of one-shot agents
 * Uses @openai/agents SDK for all non-copilot LLM calls
 */

import { Agent } from '@openai/agents';
import { MODEL_SUGGESTION, MODEL_MATCH } from './models';
import { SPACE_GEN_SYSTEM_PROMPT } from './prompts/space-gen.prompt';
import { COMMUNITY_GEN_SYSTEM_PROMPT } from './prompts/community-gen.prompt';
import { OPPORTUNITY_GEN_SYSTEM_PROMPT } from './prompts/opportunity-gen.prompt';
import { RECOMMENDATION_SYSTEM_PROMPT } from './prompts/recommendation.prompt';

// --- Space Generation (OpenAI) ---

export function createSpaceGenAgent(): Agent {
  return new Agent({
    name: 'Space Generator',
    model: MODEL_SUGGESTION,
    instructions: SPACE_GEN_SYSTEM_PROMPT,
  });
}

// --- Community Generation (OpenAI) ---

export function createCommunityGenAgent(): Agent {
  return new Agent({
    name: 'Community Generator',
    model: MODEL_SUGGESTION,
    instructions: COMMUNITY_GEN_SYSTEM_PROMPT,
  });
}

// --- Opportunity Generation (OpenAI) ---

export function createOpportunityGenAgent(): Agent {
  return new Agent({
    name: 'Opportunity Generator',
    model: MODEL_SUGGESTION,
    instructions: OPPORTUNITY_GEN_SYSTEM_PROMPT,
  });
}

// --- Recommendation (OpenAI nano) ---

export function createRecommendationAgent(): Agent {
  return new Agent({
    name: 'Recommendation Generator',
    model: MODEL_MATCH,
    instructions: RECOMMENDATION_SYSTEM_PROMPT,
  });
}

// --- Suggestions (OpenAI) ---

export function createSuggestionsAgent(systemPrompt: string): Agent {
  return new Agent({
    name: 'Suggestions Generator',
    model: MODEL_SUGGESTION,
    instructions: systemPrompt,
  });
}

// --- Intent Suggestions (OpenAI) ---

export function createIntentSuggestionsAgent(systemPrompt: string): Agent {
  return new Agent({
    name: 'Intent Predictor',
    model: MODEL_SUGGESTION,
    instructions: systemPrompt,
  });
}
