/**
 * Centralized LLM model configuration
 * Single source of truth — all model references import from here
 * Upgraded to GPT-5 family (Feb 2026) — drop-in replacements for GPT-4.1
 */

/** Complex reasoning with tool orchestration (copilot main agents) */
export const MODEL_T1 = 'gpt-5';

/** Vision, document analysis, search synthesis (sub-agents) */
export const MODEL_T2 = 'gpt-5-mini';

/** Simple text generation, classification, summarization */
export const MODEL_T3 = 'gpt-5-nano';

/** Image generation */
export const MODEL_IMAGE = 'gpt-image-1';

/** Speech-to-text */
export const MODEL_STT = 'whisper-1';

/** Text embeddings */
export const MODEL_EMBEDDING = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
