/**
 * AI Provider Configuration — direct OpenAI API only
 *
 * GPT-5.6 features used by the agents (Responses, native continuity and
 * prompt-cache controls) require the official OpenAI API. Alternate base URLs
 * are deliberately not supported in production.
 *
 * - Chat (agent, fast, suggestions, vision), embeddings → OpenAI-compatible client below.
 * - Media (image/STT/TTS) uses the provider's native inference API — see media.client.ts.
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { logger } from '../../utils';

const AI_API_KEY = process.env.OPENAI_API_KEY || '';

// ---------------------------------------------------------------------------
// OpenAI-compatible client — chat + embeddings
// ---------------------------------------------------------------------------

const aiClient = new OpenAI({
  apiKey: AI_API_KEY,
});

// ---------------------------------------------------------------------------
// Status log
// ---------------------------------------------------------------------------

if (AI_API_KEY) {
  logger.info('[AI Provider] OpenAI API — chat + embeddings');
} else {
  logger.warn('[AI Provider] OPENAI_API_KEY missing — AI calls may fail');
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

/** Delete a temporary provider file across OpenAI SDK versions. */
export async function deleteAIFile(fileId: string): Promise<void> {
  const files = aiClient.files as any;
  const deleteFile = files.delete ?? files.del;
  if (typeof deleteFile !== 'function') return;
  await deleteFile.call(files, fileId);
}
