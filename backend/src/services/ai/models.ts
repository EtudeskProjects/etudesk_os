/**
 * Centralized LLM model configuration — Multi-provider by usage
 * Single source of truth — all model references import from here.
 *
 * Each constant targets the best provider for its use case:
 * - Google Gemini: form suggestions (cheapest, fastest)
 * - Anthropic Claude: agents + guardrails/summaries (best reasoning)
 * - OpenAI: images, web search, embeddings, STT, matching, vision
 */

// --- Google Gemini (form suggestions — cheapest, fastest) ---

/** Form generation: spaces, communities, opportunities, bios, daily objectives, WhatsApp */
export const MODEL_SUGGESTION = 'gemini-2.5-flash-lite';

// --- Anthropic Claude (agents — best reasoning + tool use) ---

/** Main copilot agents: talent explorer, org explorer, study mode */
// Upgraded 2026-02-15: Claude Opus 4.6 (Anthropic)
// Anthropic model aliases are stable; pinning a dated suffix is optional.
export const MODEL_AGENT = 'claude-opus-4-6';

/** Fast tasks: summaries, titles, guardrails, intent suggestions */
export const MODEL_FAST = 'claude-haiku-4-5-20251001';

// --- OpenAI (specialized capabilities) ---

/** Image generation (DALL-E / gpt-image) */
export const MODEL_IMAGE = 'gpt-image-1';

/** Web search synthesis + document vision/extraction */
export const MODEL_SEARCH = 'gpt-4.1-mini';

/** Recommendations matching (cost-effective) */
export const MODEL_MATCH = 'gpt-4.1-nano';

/** Speech-to-text (Whisper — always OpenAI) */
export const MODEL_STT = 'whisper-1';

/** Text embeddings (always OpenAI for Pinecone 1536d compat) */
export const MODEL_EMBEDDING = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
