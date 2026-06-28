/**
 * AI Usage / COGS accounting — single source of truth for model pricing.
 *
 * Every LLM/AI call should call recordUsage(...) so we can compute true COGS
 * per feature and guarantee margin. recordUsage is fire-and-forget: it NEVER
 * throws into the caller (accounting must not break the product path).
 *
 * Pricing is USD per 1,000,000 tokens unless noted. Verified June 2026.
 * Update PRICING here (and ONLY here) when provider prices change.
 */

import { pool } from '../database';
import { logger } from '../../utils';

export type AIProvider = 'ai';

interface TokenPricing {
  provider: AIProvider;
  input: number;        // $/1M input tokens
  output: number;       // $/1M output tokens
  cacheWrite?: number;  // $/1M cache-creation tokens when provider supports prompt caching
  cacheRead?: number;   // $/1M cache-read tokens when provider supports prompt caching
}

/**
 * Per-1M-token pricing (USD). Current provider model prices.
 * The actual provider is configured via env. Cache fields apply only where the
 * model/provider exposes prompt caching.
 */
export const PRICING: Record<string, TokenPricing> = {
  // --- Current provider models ---
  'Qwen/Qwen3-235B-A22B-Instruct-2507': { provider: 'ai', input: 0.09, output: 0.10 },
  'deepseek-ai/DeepSeek-V3.2': { provider: 'ai', input: 0.26, output: 0.38, cacheRead: 0.13 },
  'deepseek-ai/DeepSeek-V4-Flash': { provider: 'ai', input: 0.10, output: 0.20 },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': { provider: 'ai', input: 0.08, output: 0.30 },
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct': { provider: 'ai', input: 0.15, output: 0.60 },
  'Qwen/Qwen3-VL-235B-A22B-Instruct': { provider: 'ai', input: 0.20, output: 0.88 },
  'google/gemma-3-27b-it': { provider: 'ai', input: 0.08, output: 0.16 },
  'BAAI/bge-m3': { provider: 'ai', input: 0.01, output: 0 },
  'Qwen/Qwen3-Embedding-8B': { provider: 'ai', input: 0.01, output: 0 },
  // STT/TTS are priced per minute / per char, not tokens — handled via metadata, cost approximated elsewhere.
  'openai/whisper-large-v3-turbo': { provider: 'ai', input: 0, output: 0 },
  'hexgrad/Kokoro-82M': { provider: 'ai', input: 0, output: 0 },
};

/** STT cost estimate per minute. */
export const STT_USD_PER_MINUTE = 0.0002;
/** TTS cost estimate per 1M chars. */
export const TTS_USD_PER_1M_CHARS = 0.8;
/** Image cost per generated image, by FLUX variant (approx). */
export const IMAGE_FLUX_USD: Record<string, number> = {
  'black-forest-labs/FLUX-1-schnell': 0.0011,
  'black-forest-labs/FLUX-2-dev': 0.012,
  'black-forest-labs/FLUX-2-pro': 0.015,
};

/** Image pricing: USD per generated image. */
export const IMAGE_PRICE_USD: Record<string, number> = {
  low: 0.0011,
  medium: 0.0011,
  high: 0.012,
};

const FCFA_PER_USD = Number(process.env.FCFA_PER_USD || 605);

export function usdToFcfa(usd: number): number {
  return usd * FCFA_PER_USD;
}

export interface RecordUsageParams {
  feature: string;
  model: string;
  /** Raw usage object from the configured API client. */
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;        // OpenAI naming
    completion_tokens?: number;    // OpenAI naming
    total_tokens?: number;         // OpenAI embeddings
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  } | null;
  /** For image generation. */
  images?: { count: number; quality?: 'low' | 'medium' | 'high' };
  /** For TTS/STT. */
  audioSeconds?: number;
  scopeTalentId?: string | null;
  scopeOrganizationId?: string | null;
  sessionId?: string | null;
  billedActionCode?: string | null;
  metadata?: Record<string, unknown>;
}

interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  imageCount: number;
  audioSeconds: number;
  costUsd: number;
}

/** Compute COGS for a single call. Exported so guardrails can budget against it. */
export function computeCost(params: RecordUsageParams): NormalizedUsage {
  const u = params.usage || {};
  const inputTokens = u.input_tokens ?? u.prompt_tokens ?? 0;
  const outputTokens = u.output_tokens ?? u.completion_tokens ?? 0;
  const cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = u.cache_read_input_tokens ?? 0;
  // Embeddings report only total_tokens — treat as input.
  const embeddingTokens = !inputTokens && !outputTokens && u.total_tokens ? u.total_tokens : 0;

  const price = PRICING[params.model];
  let costUsd = 0;

  if (price) {
    costUsd += ((inputTokens + embeddingTokens) / 1_000_000) * price.input;
    costUsd += (outputTokens / 1_000_000) * price.output;
    costUsd += (cacheCreationTokens / 1_000_000) * (price.cacheWrite ?? price.input);
    costUsd += (cacheReadTokens / 1_000_000) * (price.cacheRead ?? price.input * 0.1);
  } else if (!params.images && !params.audioSeconds) {
    logger.warn(`[ai-usage] No pricing for model "${params.model}" (feature: ${params.feature}). Recording tokens with cost=0.`);
  }

  const imageCount = params.images?.count ?? 0;
  if (imageCount > 0) {
    const perImage = IMAGE_FLUX_USD[params.model] ?? IMAGE_PRICE_USD[params.images?.quality ?? 'medium'] ?? IMAGE_PRICE_USD.medium;
    costUsd += imageCount * perImage;
  }

  const audioSeconds = params.audioSeconds ?? 0;
  // TTS audio output billed per audio token (~$12/1M); approx 1 audio token ~ 1.5ms.
  // We log seconds for visibility; token-based cost already covered above when usage provided.

  return {
    inputTokens: inputTokens + embeddingTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    imageCount,
    audioSeconds,
    costUsd: Number(costUsd.toFixed(6)),
  };
}

/**
 * Record one AI call. Fire-and-forget — awaiting is optional; failures are
 * swallowed so accounting can never break the product path.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  try {
    const c = computeCost(params);
    const price = PRICING[params.model];
    const provider: AIProvider = price?.provider ?? 'ai';

    await pool.query(
      `INSERT INTO ai_usage (
        provider, model, feature, billed_action_code,
        talent_id, organization_id, session_id,
        input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
        image_count, audio_seconds, cost_usd, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        provider,
        params.model,
        params.feature,
        params.billedActionCode ?? null,
        params.scopeTalentId ?? null,
        params.scopeOrganizationId ?? null,
        params.sessionId ?? null,
        c.inputTokens,
        c.outputTokens,
        c.cacheCreationTokens,
        c.cacheReadTokens,
        c.imageCount,
        c.audioSeconds,
        c.costUsd,
        JSON.stringify(params.metadata ?? {}),
      ]
    );
  } catch (err: any) {
    logger.error(`[ai-usage] Failed to record usage for ${params.feature}/${params.model}: ${err?.message}`);
  }
}
