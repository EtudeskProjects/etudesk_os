/**
 * Centralized LLM model configuration — Multi-provider by usage
 * Single source of truth — all model references import from here.
 *
 * Each constant targets the best provider for its use case:
 * - Anthropic Claude: agents + guardrails/summaries (best reasoning)
 * - OpenAI: form suggestions, images, web search, embeddings, STT, matching, vision
 *
 * Updated 2026-06 to the current OpenAI lineup (GPT-5.4 family + gpt-image-2).
 * Note: GPT-5 chat models reject a custom `temperature` and require
 * `max_completion_tokens` (not `max_tokens`) — call sites are aligned accordingly.
 */

// --- OpenAI (form suggestions — gpt-5.4-nano: fast/cheap) ---

/** Form generation: spaces, communities, opportunities, bios, daily objectives, WhatsApp */
export const MODEL_SUGGESTION = 'gpt-5.4-nano';

// --- Anthropic Claude (agents — best reasoning + tool use) ---

/** Main copilot agents: talent explorer, org explorer, study mode */
// Sonnet line (balanced quality/cost). Uses Anthropic alias by default.
// Override with ANTHROPIC_MODEL_AGENT to pin a snapshot when needed.
export const MODEL_AGENT = process.env.ANTHROPIC_MODEL_AGENT || 'claude-sonnet-4-6';

/** Fast tasks: summaries, titles, guardrails, intent suggestions */
export const MODEL_FAST = 'claude-haiku-4-5';

// --- OpenAI (specialized capabilities) ---

/** Image generation — gpt-image-2 (current SOTA, used by the study tutor for illustrations) */
export const MODEL_IMAGE = 'gpt-image-2';

/** Document vision/extraction + KYC (gpt-5.4-mini: vision-capable, low latency) */
export const MODEL_SEARCH = 'gpt-5.4-mini';

/** Recommendations matching (cost-effective — gpt-5.4-nano) */
export const MODEL_MATCH = 'gpt-5.4-nano';

/** Speech-to-text (OpenAI — gpt-4o-mini-transcribe: lower WER, better French recognition than whisper-1) */
export const MODEL_STT = 'gpt-4o-mini-transcribe';

/** Text-to-speech (OpenAI — gpt-4o-mini-tts: steerable voice with instructions parameter) */
export const MODEL_TTS = 'gpt-4o-mini-tts';

/** Text embeddings (always OpenAI for Pinecone 1536d compat) */
export const MODEL_EMBEDDING = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
