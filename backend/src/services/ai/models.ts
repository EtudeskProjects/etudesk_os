/**
 * Centralized LLM model configuration — provider-neutral by usage.
 * Single source of truth — all model references import from here.
 *
 * MIGRATION (2026-06): moved to a single OpenAI-compatible AI provider.
 * MIGRATION (2026-07): direct OpenAI GPT-5.6 family routing.
 * No provider fallback: each workload has one explicit model tier.
 */

// --- GPT-5.6 tiers ---
const DEFAULT_AGENT_MODEL = 'gpt-5.6-terra';
const DEFAULT_FAST_MODEL = 'gpt-5.6-luna';
const DEFAULT_COMPLEX_MODEL = 'gpt-5.6-sol';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1-mini';
const DEFAULT_STT_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

/** Main copilot agents: talent explorer, org explorer, study mode. */
export const MODEL_AGENT = process.env.AI_MODEL_AGENT || DEFAULT_AGENT_MODEL;

/** Fast tasks: summaries, titles, guardrails, intent suggestions. */
export const MODEL_FAST = process.env.AI_MODEL_FAST || DEFAULT_FAST_MODEL;

/** Form generation: spaces, communities, opportunities, bios, daily objectives. */
export const MODEL_SUGGESTION = process.env.AI_MODEL_SUGGESTION || DEFAULT_FAST_MODEL;

/** Recommendations matching (cost-effective). */
export const MODEL_MATCH = process.env.AI_MODEL_MATCH || DEFAULT_FAST_MODEL;

/** Document vision/extraction + KYC (vision-capable, OCR 32 langues incl. FR). */
export const MODEL_SEARCH = process.env.AI_MODEL_VISION || DEFAULT_COMPLEX_MODEL;

// --- Media (provider inference API, not necessarily OpenAI-compatible) ---

/** Image generation — FLUX (schnell = cheapest, dev = higher quality). */
export const MODEL_IMAGE = process.env.AI_MODEL_IMAGE || DEFAULT_IMAGE_MODEL;

/** Speech-to-text — Whisper large v3 turbo (best WER, multilingual FR). */
export const MODEL_STT = process.env.AI_MODEL_STT || DEFAULT_STT_MODEL;

/** Text-to-speech — Kokoro 82M. */
export const MODEL_TTS = process.env.AI_MODEL_TTS || DEFAULT_TTS_MODEL;

// --- Embeddings ---

/** Text embeddings — BGE-M3 (1024d, multilingual 100+ langues). Stored in pgvector.
 *  Keep EMBEDDING_DIMENSION (provider/db) in sync with whatever model is set here. */
export const MODEL_EMBEDDING = process.env.AI_MODEL_EMBEDDING || DEFAULT_EMBEDDING_MODEL;

/** Embedding vector dimension. BGE-M3 = 1024. Must match the pgvector column. */
export const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '1024', 10);
