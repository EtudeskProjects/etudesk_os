/**
 * AI Provider Configuration — Multi-provider (simultaneous)
 *
 * Two providers used simultaneously for their strengths:
 * - OpenAI: suggestions, images, web search, embeddings, STT, matching, vision
 * - Anthropic Claude: main agents (native SDK), summaries/titles/guardrails (Haiku)
 *
 * OPENAI_API_KEY is ALWAYS required.
 * ANTHROPIC_API_KEY required for Claude agents.
 * GOOGLE_API_KEY: no longer used (project banned). All Gemini calls migrated to OpenAI.
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { OpenAIProvider } from '@openai/agents';
import { logger } from '../../utils';

// ---------------------------------------------------------------------------
// 1. OpenAI Client — STT, moderation, embeddings, images, web search, vision
// ---------------------------------------------------------------------------

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------------------------------------------
// 2. Suggestion Client — uses OpenAI (migrated from Gemini, Google API blocked)
// ---------------------------------------------------------------------------

// Gemini client kept as null — all callers fall back to OpenAI via getGeminiClient()
const geminiClient: OpenAI | null = null;

// ---------------------------------------------------------------------------
// 3. Anthropic Client — Native SDK for agents, guardrails, titles
// ---------------------------------------------------------------------------

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ---------------------------------------------------------------------------
// ModelProvider instances for @openai/agents run() overrides
// (Still needed for Gemini suggestions + OpenAI web search sub-agent)
// ---------------------------------------------------------------------------

/** OpenAI provider for agents that MUST run on OpenAI (recommendations, etc.) */
export const openaiProvider = new OpenAIProvider({
  openAIClient: openaiClient as any,
  useResponses: false,
});

/** OpenAI Responses API provider — for webSearchTool() which needs Responses API */
export const openaiResponsesProvider = new OpenAIProvider({
  openAIClient: openaiClient as any,
  useResponses: true,
});

/** Suggestion provider for agents (migrated from Gemini to OpenAI) */
export const geminiProvider = openaiProvider;

// ---------------------------------------------------------------------------
// Log provider status
// ---------------------------------------------------------------------------

if (process.env.ANTHROPIC_API_KEY) {
  logger.info('[AI Provider] ANTHROPIC (native SDK for agents), OPENAI (images/STT/embeddings/vision/web-search), GEMINI (suggestions)');
} else {
  logger.warn('[AI Provider] ANTHROPIC_API_KEY missing — agents will fail');
}

if (!process.env.OPENAI_API_KEY) {
  logger.warn('[AI Provider] OPENAI_API_KEY missing — STT, moderation, embeddings, images unavailable');
}

// GOOGLE_API_KEY no longer required — all suggestions use OpenAI
if (process.env.GOOGLE_API_KEY) {
  logger.info('[AI Provider] GOOGLE_API_KEY present but unused — suggestions migrated to OpenAI');
}

// ---------------------------------------------------------------------------
// Client getters
// ---------------------------------------------------------------------------

/** Anthropic client — for main agents, guardrails, titles */
export function getAnthropicClient(): Anthropic { return anthropicClient; }

/** Suggestion client — returns OpenAI (migrated from Gemini) */
export function getGeminiClient(): OpenAI {
  return openaiClient;
}

/** OpenAI client — STT (whisper), moderation, vision, files API */
export function getOpenAIClient(): OpenAI { return openaiClient; }

/** Image generation — always OpenAI (gpt-image-1) */
export function getImageClient(): OpenAI { return openaiClient; }

/** Embeddings — always OpenAI (Pinecone 1536d compat) */
export function getEmbeddingClient(): OpenAI { return openaiClient; }
