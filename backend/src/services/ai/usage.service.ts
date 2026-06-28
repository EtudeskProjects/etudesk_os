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

export type AIProvider = 'anthropic' | 'openai';

interface TokenPricing {
  provider: AIProvider;
  input: number;        // $/1M input tokens
  output: number;       // $/1M output tokens
  cacheWrite?: number;  // $/1M cache-creation tokens (Anthropic; 5-min TTL = 1.25x input)
  cacheRead?: number;   // $/1M cache-read tokens (Anthropic; 0.1x input)
}

/** Per-1M-token pricing. Cache 5-min TTL: write = 1.25x input, read = 0.1x input. */
export const PRICING: Record<string, TokenPricing> = {
  // --- Anthropic ---
  'claude-sonnet-4-6': { provider: 'anthropic', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5': { provider: 'anthropic', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  // --- OpenAI ---
  'gpt-5.4-nano': { provider: 'openai', input: 0.2, output: 1.25 },
  'gpt-5.4-mini': { provider: 'openai', input: 0.75, output: 4.5 },
  'gpt-4.1-mini': { provider: 'openai', input: 0.4, output: 1.6 },
  'text-embedding-3-small': { provider: 'openai', input: 0.02, output: 0 },
  'gpt-4o-mini-transcribe': { provider: 'openai', input: 1.25, output: 5 },
  'gpt-4o-mini-tts': { provider: 'openai', input: 0.6, output: 12 },
};

/**
 * Image pricing: USD per generated image, by quality. gpt-image-1 / gpt-image-2.
 * We cap quality at 'medium' by default to protect margin (see generate-image tool).
 */
export const IMAGE_PRICE_USD: Record<string, number> = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
};

const FCFA_PER_USD = Number(process.env.FCFA_PER_USD || 605);

export function usdToFcfa(usd: number): number {
  return usd * FCFA_PER_USD;
}

export interface RecordUsageParams {
  feature: string;
  model: string;
  /** Raw usage object from the SDK (Anthropic Message.usage or OpenAI response.usage). */
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
    const perImage = IMAGE_PRICE_USD[params.images?.quality ?? 'medium'] ?? IMAGE_PRICE_USD.medium;
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
    const provider: AIProvider = price?.provider ?? (params.model.startsWith('claude') ? 'anthropic' : 'openai');

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
