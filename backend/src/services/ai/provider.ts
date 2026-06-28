/**
 * AI Provider Configuration — single OpenAI-compatible provider
 *
 * MIGRATION (2026-06): consolidated onto one OpenAI-compatible AI provider.
 *   base_url: AI_BASE_URL
 *   key:      AI_API_KEY
 *
 * - Chat (agent, fast, suggestions, vision), embeddings → OpenAI-compatible client below.
 * - Media (image/STT/TTS) uses the provider's native inference API — see media.client.ts.
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { logger } from '../../utils';

const AI_BASE_URL = process.env.AI_BASE_URL || '';
const AI_API_KEY = process.env.AI_API_KEY || '';

// ---------------------------------------------------------------------------
// OpenAI-compatible client — chat + embeddings
// ---------------------------------------------------------------------------

const aiClient = new OpenAI({
  apiKey: AI_API_KEY,
  ...(AI_BASE_URL ? { baseURL: AI_BASE_URL } : {}),
});

// ---------------------------------------------------------------------------
// Status log
// ---------------------------------------------------------------------------

if (AI_API_KEY && AI_BASE_URL) {
  logger.info(`[AI Provider] OpenAI-compatible provider (${AI_BASE_URL}) — chat + embeddings`);
} else {
  logger.warn('[AI Provider] AI_API_KEY or AI_BASE_URL missing — AI calls may fail');
}

// ---------------------------------------------------------------------------
// Client getters — all return the single AI client.
// ---------------------------------------------------------------------------

/** Main chat client (agent, guardrails, summaries, titles, suggestions, vision). */
export function getChatClient(): OpenAI { return aiClient; }

/** Suggestion client. */
export function getSuggestionClient(): OpenAI { return aiClient; }

/** General chat / vision / files client. */
export function getAIClient(): OpenAI { return aiClient; }

/** Image generation client. */
export function getImageClient(): OpenAI { return aiClient; }

/** Embeddings client, stored in pgvector. */
export function getEmbeddingClient(): OpenAI { return aiClient; }
