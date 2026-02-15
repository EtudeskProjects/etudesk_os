/**
 * AI Provider Configuration — Multi-provider (simultaneous)
 *
 * Three providers used simultaneously for their strengths:
 * - Google Gemini Flash Lite: form suggestions (cheapest, fastest)
 * - OpenAI: images, web search, embeddings, STT, matching, vision
 * - Anthropic Claude: main agents (native SDK), summaries/titles/guardrails (Haiku)
 *
 * OPENAI_API_KEY is ALWAYS required (STT, moderation, embeddings, images, vision).
 * GOOGLE_API_KEY required for Gemini suggestions.
 * ANTHROPIC_API_KEY required for Claude agents.
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
// 2. Gemini Client — OpenAI-compatible endpoint for chat.completions
// ---------------------------------------------------------------------------

const geminiClient = process.env.GOOGLE_API_KEY
  ? new OpenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  : null;

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

/** Gemini provider for agents (suggestions via run()) */
export const geminiProvider = geminiClient
  ? new OpenAIProvider({
      openAIClient: geminiClient as any,
      useResponses: false,
    })
  : openaiProvider; // fallback to OpenAI if no Gemini key

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

if (!process.env.GOOGLE_API_KEY) {
  logger.warn('[AI Provider] GOOGLE_API_KEY missing — suggestions will use OpenAI fallback');
}

// ---------------------------------------------------------------------------
// Client getters
// ---------------------------------------------------------------------------

/** Anthropic client — for main agents, guardrails, titles */
export function getAnthropicClient(): Anthropic { return anthropicClient; }

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
