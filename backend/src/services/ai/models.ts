/**
 * Centralized LLM model configuration — provider-neutral by usage.
 * Single source of truth — all model references import from here.
 *
 * MIGRATION (2026-06): moved to a single OpenAI-compatible AI provider.
 * Every id is env-overridable because provider model slugs/versions change.
 *
 * Provider routing now goes through a single AI client (see provider.ts).
 */

// --- Main copilot agent (best open reasoning + tool use) ---

/** Main copilot agents: talent explorer, org explorer, study mode. */
export const MODEL_AGENT = process.env.AI_MODEL_AGENT || 'provider/agent-model';

/** Fast tasks: summaries, titles, guardrails, intent suggestions. */
export const MODEL_FAST = process.env.AI_MODEL_FAST || 'meta-llama/Llama-4-Scout-17B-16E-Instruct';

/** Form generation: spaces, communities, opportunities, bios, daily objectives. */
export const MODEL_SUGGESTION = process.env.AI_MODEL_SUGGESTION || 'meta-llama/Llama-4-Scout-17B-16E-Instruct';

/** Recommendations matching (cost-effective). */
export const MODEL_MATCH = process.env.AI_MODEL_MATCH || 'meta-llama/Llama-4-Scout-17B-16E-Instruct';

/** Document vision/extraction + KYC (vision-capable, OCR 32 langues incl. FR). */
export const MODEL_SEARCH = process.env.AI_MODEL_VISION || 'Qwen/Qwen3-VL-235B-A22B-Instruct';

// --- Media (provider inference API, not necessarily OpenAI-compatible) ---

/** Image generation — FLUX (schnell = cheapest, dev = higher quality). */
export const MODEL_IMAGE = process.env.AI_MODEL_IMAGE || 'black-forest-labs/FLUX-1-schnell';

/** Speech-to-text — Whisper large v3 turbo (best WER, multilingual FR). */
export const MODEL_STT = process.env.AI_MODEL_STT || 'openai/whisper-large-v3-turbo';

/** Text-to-speech — Kokoro 82M. */
export const MODEL_TTS = process.env.AI_MODEL_TTS || 'hexgrad/Kokoro-82M';

// --- Embeddings ---

/** Text embeddings — BGE-M3 (1024d, multilingual 100+ langues). Stored in pgvector.
 *  Keep EMBEDDING_DIMENSION (provider/db) in sync with whatever model is set here. */
export const MODEL_EMBEDDING = process.env.AI_MODEL_EMBEDDING || 'BAAI/bge-m3';

/** Embedding vector dimension. BGE-M3 = 1024. Must match the pgvector column. */
export const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '1024', 10);
