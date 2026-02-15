/**
 * AI Services — Centralized exports
 */

export {
  createSpaceGenAgent,
  createCommunityGenAgent,
  createOpportunityGenAgent,
  createRecommendationAgent,
  createSuggestionsAgent,
} from './agent-factory';

export { getAnthropicClient } from './provider';

export { buildExtractionPrompt, EXTRACTION_SYSTEM_PROMPT } from './prompts/extraction.prompt';
export { buildSpaceGenPrompt, SPACE_GEN_SYSTEM_PROMPT } from './prompts/space-gen.prompt';
export { buildCommunityGenPrompt, COMMUNITY_GEN_SYSTEM_PROMPT } from './prompts/community-gen.prompt';
export { buildOpportunityGenPrompt, OPPORTUNITY_GEN_SYSTEM_PROMPT } from './prompts/opportunity-gen.prompt';
export { buildRecommendationPrompt, RECOMMENDATION_SYSTEM_PROMPT } from './prompts/recommendation.prompt';
export { buildKYCVerificationPrompt, buildQuickCheckPrompt, KYC_SYSTEM_PROMPT } from './prompts/kyc.prompt';
export { SESSION_TITLE_SYSTEM_PROMPT, buildSuggestionsSystemPrompt } from './prompts/session-utils.prompt';
