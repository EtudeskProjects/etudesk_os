/**
 * Agent Factory — Centralized creation of one-shot agents
 * Uses @openai/agents SDK for all non-copilot LLM calls
 */

import { Agent } from '@openai/agents';
import {
  EXTRACTION_SYSTEM_PROMPT,
} from './prompts/extraction.prompt';
import { SPACE_GEN_SYSTEM_PROMPT } from './prompts/space-gen.prompt';
import { COMMUNITY_GEN_SYSTEM_PROMPT } from './prompts/community-gen.prompt';
import { OPPORTUNITY_GEN_SYSTEM_PROMPT } from './prompts/opportunity-gen.prompt';
import { RECOMMENDATION_SYSTEM_PROMPT } from './prompts/recommendation.prompt';
import { KYC_SYSTEM_PROMPT } from './prompts/kyc.prompt';
import { SESSION_TITLE_SYSTEM_PROMPT } from './prompts/session-utils.prompt';
import { BIO_GEN_SYSTEM_PROMPT } from './prompts/bio-gen.prompt';

// ═══════════════════════════════════════════════════════════════
// DOCUMENT EXTRACTION
// ═══════════════════════════════════════════════════════════════

export function createExtractionAgent(): Agent {
  return new Agent({
    name: 'Document Extractor',
    model: 'gpt-4.1-mini',
    instructions: EXTRACTION_SYSTEM_PROMPT,
    modelSettings: {
      temperature: 0.1,
    },
  });
}

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
// KYC VERIFICATION
// ═══════════════════════════════════════════════════════════════

export function createKYCAgent(): Agent {
  return new Agent({
    name: 'KYC Verifier',
    model: 'gpt-4.1-nano',
    instructions: KYC_SYSTEM_PROMPT,
  });
}

// ═══════════════════════════════════════════════════════════════
// BIO GENERATION
// ═══════════════════════════════════════════════════════════════

export function createBioGenAgent(): Agent {
  return new Agent({
    name: 'Bio Generator',
    model: 'gpt-4.1-nano',
    instructions: BIO_GEN_SYSTEM_PROMPT,
    modelSettings: {
      temperature: 0.8,
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// SESSION UTILS (Title + Suggestions)
// ═══════════════════════════════════════════════════════════════

export function createTitleAgent(): Agent {
  return new Agent({
    name: 'Session Title Generator',
    model: 'gpt-5-nano',
    instructions: SESSION_TITLE_SYSTEM_PROMPT,
    modelSettings: {
      temperature: 0.3,
    },
  });
}

export function createSuggestionsAgent(systemPrompt: string): Agent {
  return new Agent({
    name: 'Suggestions Generator',
    model: 'gpt-5-nano',
    instructions: systemPrompt,
    modelSettings: {
      temperature: 0.7,
    },
  });
}
