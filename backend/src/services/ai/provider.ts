/**
 * AI Provider Configuration — Multi-provider (simultaneous)
 *
 * Three providers used simultaneously for their strengths:
 * - Google Gemini Flash Lite: form suggestions (cheapest, fastest)
 * - OpenAI: images, web search, embeddings, STT, matching, vision/extraction
 * - Anthropic Claude: main agents (Sonnet), summaries/titles/guardrails (Haiku)
 *
 * OPENAI_API_KEY is ALWAYS required (STT, moderation, embeddings, images, vision).
 * GOOGLE_API_KEY required for Gemini suggestions.
 * ANTHROPIC_API_KEY required for Claude agents.
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { OpenAIProvider, setDefaultModelProvider } from '@openai/agents';
import { AnthropicProvider } from './anthropic-provider';
import { logger } from '../../utils';

// ---------------------------------------------------------------------------
// 1. OpenAI Client — STT, moderation, embeddings, images, web search, vision
// ---------------------------------------------------------------------------

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------------------------------------------
// 2. Gemini Client — OpenAI-compatible endpoint for chat.completions
// ---------------------------------------------------------------------------

const geminiClient = process.env.GOOGLE_API_KEY
  ? new OpenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  : null;

// ---------------------------------------------------------------------------
// 3. Anthropic Provider — native SDK via adapter
// ---------------------------------------------------------------------------

export const anthropicProvider = new AnthropicProvider();

// ---------------------------------------------------------------------------
// ModelProvider instances for @openai/agents run() overrides
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

/** Gemini provider for agents (suggestions via run()) */
export const geminiProvider = geminiClient
  ? new OpenAIProvider({
      openAIClient: geminiClient as any,
      useResponses: false,
    })
  : openaiProvider; // fallback to OpenAI if no Gemini key

// ---------------------------------------------------------------------------
// Set default model provider for all run() calls → Anthropic
// ---------------------------------------------------------------------------

if (process.env.ANTHROPIC_API_KEY) {
  setDefaultModelProvider(anthropicProvider);
  logger.info('[AI Provider] Default: ANTHROPIC (agents), OPENAI (images/STT/embeddings/vision), GEMINI (suggestions)');
} else {
  // Fallback: OpenAI for everything if no Anthropic key
  logger.warn('[AI Provider] ANTHROPIC_API_KEY missing — falling back to OpenAI for agents');
}

if (!process.env.OPENAI_API_KEY) {
  logger.warn('[AI Provider] OPENAI_API_KEY missing — STT, moderation, embeddings, images unavailable');
}

if (!process.env.GOOGLE_API_KEY) {
  logger.warn('[AI Provider] GOOGLE_API_KEY missing — suggestions will use OpenAI fallback');
}

// ---------------------------------------------------------------------------
// Client getters (for direct chat.completions.create calls)
// ---------------------------------------------------------------------------

/** Gemini client for form suggestions (chat.completions.create) */
export function getGeminiClient(): OpenAI {
  if (!geminiClient) {
    logger.warn('[AI Provider] Gemini unavailable, falling back to OpenAI');
    return openaiClient;
  }
  return geminiClient;
}

/** OpenAI client — STT (whisper), moderation, vision, files API */
export function getOpenAIClient(): OpenAI { return openaiClient; }

/** Image generation — always OpenAI (gpt-image-1) */
export function getImageClient(): OpenAI { return openaiClient; }

/** Embeddings — always OpenAI (Pinecone 1536d compat) */
export function getEmbeddingClient(): OpenAI { return openaiClient; }

// Legacy: getAIClient() → maps to getGeminiClient for backward compat with suggestion services
// This will be removed once all callers are migrated
export function getAIClient(): OpenAI { return getGeminiClient(); }
