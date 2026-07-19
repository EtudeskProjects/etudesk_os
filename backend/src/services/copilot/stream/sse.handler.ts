/**
 * SSE Streaming Handler — OpenAI-compatible Chat Completions
 * Handles Server-Sent Events for real-time copilot responses.
 * Uses chat.completions streaming with a manual agentic loop.
 */

import { Response } from 'express';
import OpenAI from 'openai';
import type { AgentConfig } from '../tools/tool-helper';
import { SSEEvent, MessageSegment } from '../types';
import { runInputGuardrail } from '../guardrails/input.guardrail';
import { getChatClient } from '../../ai/provider';
import { computeCost, recordUsage } from '../../ai/usage.service';
import { generateToolSummary } from './tool-summary';
import { sanitizeEntityCardsByAllowedIds, sanitizeOutput } from '../guardrails/output.guardrail';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';
import { SupportedLanguage } from '../../../i18n';
import { getLanguageDisplayName } from '../../language-preference.service';
import {
  AGENTIC_LIMITS,
  buildAgentSystemText,
  buildChatCompletionTools,
  buildMissingRequiredToolMessage,
  buildToolPreface,
  enforceToolCallLimit,
  getAgentCompletionOptions,
  inferInitialToolChoice,
  inferRequiredCompletionTool,
  selectToolsForMessage,
} from '../agentic-policy';

const HEARTBEAT_INTERVAL_MS = 30_000;
const SSE_BUFFER_FLUSH_MS = 50; // Buffer text deltas and flush every 50ms
const MAX_PROVIDER_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

function byteLength(value: unknown): number {
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 'utf8');
}

function estimateCopilotCostUsd(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number): number {
  return computeCost({
    feature: 'copilot_agent',
    model,
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cache_read_input_tokens: cacheReadTokens,
    },
  }).costUsd;
}

/**
 * Send SSE comment (heartbeat) — keeps connection alive
 */
function sendHeartbeat(res: Response): void {
  res.write(': keepalive\n\n');
}

/**
 * Initialize SSE headers on the response
 */
export function initSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Send an SSE event to the client
 */
export function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOverloadedProviderError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  return (
    message.includes('overloaded_error') ||
    message.includes('"message":"overloaded"') ||
    status === 529 ||
    status === 503 ||
    status === 429
  );
}

const TOOL_RESULT_TEXT_KEYS = [
  'content',
  'message',
  'error',
  'warning',
  'fallback_suggestion',
  'summary',
  '_note',
];

const UUID_VALUE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectEntityIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  const serialized = JSON.stringify(value) || '';
  for (const match of serialized.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)) {
    if (UUID_VALUE_REGEX.test(match[0])) ids.add(match[0]);
  }
  return ids;
}

function hasMeaningfulToolText(value: unknown): boolean {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== '[no output]';
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulToolText(item));
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return TOOL_RESULT_TEXT_KEYS.some((key) =>
    hasMeaningfulToolText((value as Record<string, unknown>)[key])
  );
}

function isToolResultEffectivelyEmpty(output: unknown): boolean {
  if (output == null) {
    return true;
  }

  if (typeof output === 'string') {
    const trimmed = output.trim();
    return trimmed.length === 0 || trimmed === '[no output]';
  }

  if (Array.isArray(output)) {
    return output.length === 0;
  }

  if (typeof output !== 'object') {
    return false;
  }

  const outputObj = output as Record<string, any>;

  if (hasMeaningfulToolText(outputObj)) {
    return false;
  }

  if (outputObj.document || outputObj.mermaidCode || outputObj.renderHint || outputObj.renderConfig) {
    return false;
  }

  if (Array.isArray(outputObj.results)) {
    return outputObj.results.length === 0;
  }

  if (Array.isArray(outputObj.videos)) {
    return outputObj.videos.length === 0;
  }

  if (typeof outputObj.totalFound === 'number') {
    return outputObj.totalFound === 0;
  }

  if (outputObj.success === false) {
    return false;
  }

  return Object.keys(outputObj).length === 0;
}

/**
 * Build chat messages array from history + user message + attachments
 */
function buildMessages(
  history: Array<{ role: string; content: string }>,
  message: string,
  attachments?: Array<{ id: string; name: string; url: string; type: string; size?: number }>,
  imageBuffers?: Array<{ mimeType: string; base64: string; name: string }>
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  // Add conversation history (already alternating user/assistant from DB)
  for (const h of history) {
    if (!h.content?.trim()) continue;
    if (h.role === 'user') {
      messages.push({ role: 'user', content: h.content });
    } else if (h.role === 'assistant') {
      messages.push({ role: 'assistant', content: h.content });
    }
  }

  // Build user message with attachment context
  let userMessage = message;

  // Document attachments → mention for file_reader tool
  const docAttachments = attachments?.filter((a) => !a.type.startsWith('image/')) || [];
  if (docAttachments.length > 0) {
    const docList = docAttachments
      .map((a) => `- ${a.name} (${a.type}) [documentId: ${a.id}]`)
      .join('\n');
    userMessage += `\n\n[Pièces jointes — Documents]\n${docList}\nCall file_reader with each documentId above to read the attached document(s).`;
  }

  // Image attachments → OpenAI multimodal content parts (image_url with data URI)
  if (imageBuffers && imageBuffers.length > 0) {
    const imgNames = imageBuffers.map((b) => `- ${b.name}`).join('\n');
    userMessage += `\n\n[Pièces jointes — Images]\n${imgNames}\nThe images are provided below for direct visual analysis. Describe and analyze them.`;

    const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'text', text: userMessage },
    ];
    for (const img of imageBuffers) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      });
    }
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // Merge consecutive same-role *string* messages (OpenAI tolerates consecutive
  // roles, but merging keeps the transcript clean; skip merging multimodal parts).
  const merged: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (
      last && last.role === msg.role &&
      typeof last.content === 'string' && typeof msg.content === 'string'
    ) {
      last.content = [last.content, msg.content].filter(Boolean).join('\n') || last.content || msg.content;
    } else {
      merged.push(msg);
    }
  }

  return merged;
}

/**
 * Run an agent with SSE streaming using OpenAI-compatible chat completions.
 * Manual agentic loop: stream → collect tool_use → execute → re-submit.
 */
export async function runAgentWithSSE(
  agentConfig: AgentConfig,
  message: string,
  history: Array<{ role: string; content: string }>,
  res: Response,
  attachments?: Array<{ id: string; name: string; url: string; type: string; size?: number }>,
  statusLabels: {
    writing: string;
    toolPlanning: string;
    guardrailInjectionBlocked: string;
    guardrailBlocked: string;
    limitMaxDuration: string;
    limitMaxTokens: string;
    limitToolLoop: string;
    limitMaxTools: string;
    limitEmptyResults: string;
    providerOverloaded: string;
    providerUnavailable: string;
    safetyRefusal: string;
  } = {
    writing: 'Answer',
    toolPlanning: 'Search',
    guardrailInjectionBlocked: 'I cannot answer that request. Reframe it around your path, skills, or the platform.',
    guardrailBlocked: 'I cannot process that request. I can help with your path, skills, or Etudesk.',
    limitMaxDuration: 'Time reached. Keeping the useful results.',
    limitMaxTokens: 'Budget reached. Keeping the essentials.',
    limitToolLoop: 'Loop detected. Stopping here.',
    limitMaxTools: 'Action limit reached. Summarizing now.',
    limitEmptyResults: 'Not enough useful results. Summarizing what is available.',
    providerOverloaded: 'The AI service is temporarily busy. Please try again in a few seconds.',
    providerUnavailable: 'The AI service is temporarily unavailable. Please try again in a few seconds.',
    safetyRefusal: 'I cannot help with that request. Rephrase it or ask another question.',
  }
): Promise<{
  finalOutput: string;
  toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }>;
  segments: MessageSegment[];
  traceMetrics: {
    turnCount: number;
    toolCount: number;
    toolNames: string[];
    toolErrors: number;
    durationMs: number;
    outputChars: number;
    hasToolError: boolean;
    hitLoopDetection: boolean;
    hitTurnLimit: boolean;
    guardrailBlocked: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    firstTokenMs: number;
    firstToolMs: number;
    promptChars: number;
    toolSchemaChars: number;
  };
}> {
  const toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }> = [];
  const segments: MessageSegment[] = [];
  let finalOutput = '';
  let toolCallCounter = 0;
  let toolErrorCounter = 0;
  const turnStart = Date.now();
  let limitReached = false;
  let hitLoopDetection = false;
  let hitTurnLimit = false;
  let guardrailBlocked = false;
  let turnCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let estimatedCostUsd = 0;
  let firstTokenMs = 0;
  let firstToolMs = 0;
  let promptChars = 0;
  let toolSchemaChars = 0;
  const sameToolCounts = new Map<string, number>();
  const perToolCounts = new Map<string, number>();
  const sqlIntentCounts = new Map<string, number>();
  let consecutiveEmptyResults = 0;

  const heartbeatId = setInterval(() => sendHeartbeat(res), HEARTBEAT_INTERVAL_MS);
  logger.info(`[copilot] Start — "${message.slice(0, 100)}" (history: ${history.length} msgs)`);
  sendSSE(res, {
    type: 'status',
    phase: 'guardrail',
    label: statusLabels.toolPlanning,
    elapsedMs: Date.now() - turnStart,
  });

  try {
    // --- Run input guardrail in parallel with message building ---
    const guardrailPromise = runInputGuardrail(message);

    // Load image buffers for vision (if any)
    const imageAttachments = attachments?.filter((a) => a.type.startsWith('image/')) || [];
    const imageBuffers: Array<{ mimeType: string; base64: string; name: string }> = [];
    for (const img of imageAttachments) {
      try {
        const buffer = await getFileBuffer(img.url);
        if (buffer && buffer.length > 0) {
          imageBuffers.push({
            mimeType: img.type || 'image/png',
            base64: buffer.toString('base64'),
            name: img.name,
          });
        }
      } catch (err: any) {
        logger.error(`Failed to load image ${img.name}: ${err.message}`);
      }
    }

    // Build chat messages
    const messages = buildMessages(history, message, attachments, imageBuffers);

    // Check guardrail result
    const guardrailResult = await guardrailPromise;
    if (guardrailResult.tripwireTriggered) {
      const classification = guardrailResult.outputInfo?.classification || 'BLOCKED';
      logger.warn(`[guardrail] Input blocked — classification: ${classification}`);
      const userMessage = classification === 'INJECTION'
        ? statusLabels.guardrailInjectionBlocked
        : statusLabels.guardrailBlocked;
      sendSSE(res, { type: 'error', error: userMessage });
      guardrailBlocked = true;
      return {
        finalOutput: '', toolTrace: [], segments: [],
        traceMetrics: {
          turnCount: 0, toolCount: 0, toolNames: [], toolErrors: 0,
          durationMs: Date.now() - turnStart, outputChars: 0,
          hasToolError: false, hitLoopDetection: false, hitTurnLimit: false, guardrailBlocked: true,
          inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
          firstTokenMs: 0, firstToolMs: 0, promptChars: 0, toolSchemaChars: 0,
        },
      };
    }

    // --- Agentic loop ---
    const client = getChatClient();
    // Convert internal tool defs (name/description/input_schema) to chat-completion tools
    // function-tool format (type:function, function:{name,description,parameters}).
    const selectedToolProfile = selectToolsForMessage(agentConfig.mode, message, agentConfig.tools);
    const activeTools = selectedToolProfile.tools;
    const toolDefs = buildChatCompletionTools(activeTools);
    const completionOptions = getAgentCompletionOptions();
    const initialToolChoice = inferInitialToolChoice(agentConfig.mode, message);
    const requiredCompletionTool = inferRequiredCompletionTool(agentConfig.mode, message);
    toolSchemaChars = byteLength(toolDefs);
    let sentToolPreface = false;
    let requiredToolRetryUsed = false;

    while (turnCount < AGENTIC_LIMITS.maxTurns) {
      turnCount++;
      if (turnCount >= AGENTIC_LIMITS.maxTurns) hitTurnLimit = true;

      // Check duration limit
      if (!limitReached && Date.now() - turnStart > AGENTIC_LIMITS.maxTurnDurationMs) {
        limitReached = true;
        const limitMsg = statusLabels.limitMaxDuration;
        sendSSE(res, { type: 'limit_reached', reason: 'max_duration', message: limitMsg });
        break;
      }

      // Margin guardrail: stop before another expensive model round-trip once the
      // query has already consumed its token budget. Protects the fixed credit price.
      if (!limitReached && totalOutputTokens >= AGENTIC_LIMITS.maxOutputTokensPerQuery) {
        limitReached = true;
        const limitMsg = statusLabels.limitMaxTokens;
        logger.warn(`[copilot] Output token budget reached (${totalOutputTokens}/${AGENTIC_LIMITS.maxOutputTokensPerQuery}). Stopping run.`);
        sendSSE(res, { type: 'limit_reached', reason: 'max_tokens', message: limitMsg });
        break;
      }

      estimatedCostUsd = estimateCopilotCostUsd(agentConfig.model, totalInputTokens, totalOutputTokens, totalCacheReadTokens);
      if (!limitReached && estimatedCostUsd >= AGENTIC_LIMITS.maxCostUsdPerQuery) {
        limitReached = true;
        const limitMsg = statusLabels.limitMaxTokens;
        logger.warn(`[copilot] Cost budget reached ($${estimatedCostUsd}/${AGENTIC_LIMITS.maxCostUsdPerQuery}). Stopping run.`);
        sendSSE(res, { type: 'limit_reached', reason: 'max_cost', message: limitMsg });
        break;
      }

      // Stream the response (OpenAI-compatible chat completions).
      sendSSE(res, {
        type: 'status',
        phase: 'model_prepare',
        label: statusLabels.writing,
        elapsedMs: Date.now() - turnStart,
      });
      let response: { stopReason: string; assistantMessage: OpenAI.Chat.ChatCompletionMessageParam } | null = null;
      let currentTurnText = '';
      let toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];
      const maxAttempts = MAX_PROVIDER_RETRIES + 1;

      const systemText = buildAgentSystemText(agentConfig);
      if (turnCount === 1) {
        promptChars = byteLength(systemText) + byteLength(messages);
        logger.info(`[copilot] payload: promptChars=${promptChars}, toolSchemaChars=${toolSchemaChars}, tools=${toolDefs.length}/${agentConfig.tools.length}, toolProfile=${selectedToolProfile.reason}, history=${history.length}, maxTokens=${completionOptions.max_completion_tokens}`);
      }

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let attemptProducedOutput = false;
        currentTurnText = '';
        toolUseBlocks = [];
        // tool_calls arrive across streaming deltas, keyed by their index.
        const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {};
        let finishReason: string | null = null;
        let textBuffer = '';
        let bufferTimer: ReturnType<typeof setTimeout> | null = null;

        if (
          !sentToolPreface &&
          turnCount === 1 &&
          initialToolChoice &&
          typeof initialToolChoice === 'object' &&
          initialToolChoice.type === 'function'
        ) {
          const preface = buildToolPreface(initialToolChoice.function.name, agentConfig.language);
          finalOutput += preface;
          currentTurnText += preface;
          segments.push({ type: 'text', content: preface });
          sendSSE(res, { type: 'text_delta', delta: preface });
          sentToolPreface = true;
        }

        const flushTextBuffer = () => {
          if (textBuffer) {
            sendSSE(res, { type: 'text_delta', delta: textBuffer });
            textBuffer = '';
            attemptProducedOutput = true;
          }
          if (bufferTimer) {
            clearTimeout(bufferTimer);
            bufferTimer = null;
          }
        };

        try {
          const toolOptions = toolDefs.length > 0
            ? { tools: toolDefs, tool_choice: turnCount === 1 ? initialToolChoice || 'auto' : 'auto' }
            : {};
          const { parallel_tool_calls: parallelToolCalls, ...completionOptionsWithoutTools } = completionOptions;
          const stream = await client.chat.completions.create({
            model: agentConfig.model,
            // Keep the invariant system prefix first. GPT-5.6 can then reuse
            // it across sessions without changing the mobile SSE contract.
            messages: [{
              role: 'system',
              content: [{
                type: 'text',
                text: systemText,
                prompt_cache_breakpoint: { mode: 'explicit' },
              }],
            } as any, ...messages],
            ...toolOptions,
            ...(toolDefs.length > 0 ? { ...completionOptionsWithoutTools, parallel_tool_calls: parallelToolCalls } : completionOptionsWithoutTools),
            prompt_cache_key: `copilot:${agentConfig.mode}:${selectedToolProfile.reason}`,
            prompt_cache_options: { mode: 'implicit', ttl: '30m' },
            stream: true,
            stream_options: { include_usage: true },
          });
          logger.info(`[copilot] phase:provider_stream_open ${Date.now() - turnStart}ms`);

          for await (const chunk of stream) {
            const choice = chunk.choices?.[0];
            if (choice) {
              const delta = choice.delta;
              if (delta?.content) {
                if (!firstTokenMs) {
                  firstTokenMs = Date.now() - turnStart;
                  sendSSE(res, {
                    type: 'status',
                    phase: 'writing',
                    label: statusLabels.writing,
                    elapsedMs: firstTokenMs,
                  });
                }
                finalOutput += delta.content;
                currentTurnText += delta.content;
                textBuffer += delta.content;

                const lastSeg = segments[segments.length - 1];
                if (lastSeg && lastSeg.type === 'text') {
                  lastSeg.content = (lastSeg.content || '') + delta.content;
                } else {
                  segments.push({ type: 'text', content: delta.content });
                }

                if (!bufferTimer) {
                  bufferTimer = setTimeout(flushTextBuffer, SSE_BUFFER_FLUSH_MS);
                }
              }
              if (delta?.tool_calls) {
                if (!firstToolMs) {
                  firstToolMs = Date.now() - turnStart;
                  sendSSE(res, {
                    type: 'status',
                    phase: 'tool_planning',
                    label: statusLabels.toolPlanning,
                    elapsedMs: firstToolMs,
                  });
                }
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallAccum[idx]) {
                    flushTextBuffer();
                    toolCallAccum[idx] = { id: tc.id || '', name: '', args: '' };
                    attemptProducedOutput = true;
                  }
                  if (tc.id) toolCallAccum[idx].id = tc.id;
                  if (tc.function?.name) toolCallAccum[idx].name += tc.function.name;
                  if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments;
                }
              }
              if (choice.finish_reason) finishReason = choice.finish_reason;
            }
            // Final usage chunk (stream_options.include_usage)
            if (chunk.usage) {
              totalInputTokens += chunk.usage.prompt_tokens || 0;
              totalOutputTokens += chunk.usage.completion_tokens || 0;
              totalCacheReadTokens += (chunk.usage as any).prompt_tokens_details?.cached_tokens || 0;
              totalCacheCreationTokens += (chunk.usage as any).prompt_tokens_details?.cache_write_tokens || 0;
              estimatedCostUsd = estimateCopilotCostUsd(agentConfig.model, totalInputTokens, totalOutputTokens, totalCacheReadTokens);
            }
          }

          flushTextBuffer();

          // Finalize tool calls (ordered by streaming index).
          toolUseBlocks = Object.keys(toolCallAccum)
            .map(Number)
            .sort((a, b) => a - b)
            .map((k) => {
              const t = toolCallAccum[k];
              let parsedInput: any = {};
              try {
                parsedInput = JSON.parse(t.args || '{}');
              } catch {
                parsedInput = {};
              }
              return { id: t.id, name: t.name, input: parsedInput };
            });

          // Build the assistant message to replay on the next turn.
          const assistantMessage: OpenAI.Chat.ChatCompletionMessageParam = toolUseBlocks.length > 0
            ? {
                role: 'assistant',
                content: currentTurnText || null,
                tool_calls: toolUseBlocks.map((t) => ({
                  id: t.id,
                  type: 'function' as const,
                  function: { name: t.name, arguments: JSON.stringify(t.input) },
                })),
              }
            : { role: 'assistant', content: currentTurnText || '' };

          response = { stopReason: finishReason || 'stop', assistantMessage };
          break;
        } catch (streamError: any) {
          const isRetriable = isOverloadedProviderError(streamError) && !attemptProducedOutput && attempt < maxAttempts;
          if (!isRetriable) {
            throw streamError;
          }
          const delayMs = RETRY_BASE_DELAY_MS * attempt;
          logger.warn(`[copilot] Provider overloaded, retrying stream (${attempt}/${maxAttempts - 1}) in ${delayMs}ms`);
          await sleep(delayMs);
        }
      }

      if (!response) {
        throw new Error('Service IA temporairement indisponible. Réessayez dans quelques secondes.');
      }

      // Safety refusal (some models can return stop_reason: 'refusal' avec un
      // content vide). Sans ce garde-fou, on renvoyait une reponse vide a
      // l'utilisateur. On surface un message propre + log.
      if (response.stopReason === 'content_filter' && !finalOutput.trim()) {
        const refusalMsg = statusLabels.safetyRefusal;
        finalOutput = refusalMsg;
        segments.push({ type: 'text', content: refusalMsg });
        sendSSE(res, { type: 'text_delta', delta: refusalMsg });
        logger.warn('[copilot] Reponse refusee par le filtre de securite (finish_reason: content_filter)');
        break;
      }

      // If a task requires a finalizing tool, do not stop on an incomplete
      // "I will generate..." answer. Some open models occasionally end the turn
      // just before the required function call; one corrective continuation fixes it.
      if (
        toolUseBlocks.length === 0 &&
        requiredCompletionTool &&
        !requiredToolRetryUsed &&
        !toolTrace.some((t) => t.name === requiredCompletionTool)
      ) {
        requiredToolRetryUsed = true;
        messages.push(response.assistantMessage);
        messages.push({ role: 'user', content: buildMissingRequiredToolMessage(requiredCompletionTool) });
        continue;
      }

      // If no tool_use blocks, we're done. Some OpenAI-compatible providers
      // still report finish_reason=stop while streaming tool_calls, so the
      // presence of tool calls is authoritative here.
      if (toolUseBlocks.length === 0) {
        break;
      }

      // --- Execute tool calls ---
      // Add assistant message (with tool_calls) to conversation
      messages.push(response.assistantMessage);

      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCallCounter++;
        const toolNameCount = (perToolCounts.get(toolUse.name) || 0) + 1;
        perToolCounts.set(toolUse.name, toolNameCount);

        // Log text generated before this tool call
        if (currentTurnText.trim()) {
          logger.info(`[copilot] Agent text before tool #${toolCallCounter}: "${currentTurnText.trim().slice(0, 300)}"`);
          currentTurnText = '';
        }
        logger.info(`[copilot] Tool #${toolCallCounter}: ${toolUse.name}`, {
          args: JSON.stringify(toolUse.input),
        });

        // Loop breaker
        const argsKey = stableStringify(toolUse.input);
        const loopKey = `${toolUse.name}:${argsKey}`;
        const sameCount = (sameToolCounts.get(loopKey) || 0) + 1;
        sameToolCounts.set(loopKey, sameCount);

        if (!limitReached && sameCount > AGENTIC_LIMITS.maxSameToolCalls) {
          limitReached = true;
          hitLoopDetection = true;
          const limitMsg = statusLabels.limitToolLoop;
          logger.warn(`[copilot] Tool loop detected — ${loopKey} (#${sameCount}). Aborting run.`);
          sendSSE(res, { type: 'limit_reached', reason: 'tool_loop', message: limitMsg });
          finalOutput += `\n\n${limitMsg}`;
          sendSSE(res, { type: 'text_delta', delta: `\n\n${limitMsg}` });
          // Return cached error for remaining tool results
          toolResults.push({
            role: 'tool',
            tool_call_id: toolUse.id,
            content: JSON.stringify({ error: 'Tool loop detected. Stopping.' }),
          });
          continue;
        }

        // Check tool count limit
        if (!limitReached && toolCallCounter > AGENTIC_LIMITS.maxToolCalls) {
          limitReached = true;
          const limitMsg = statusLabels.limitMaxTools;
          sendSSE(res, { type: 'limit_reached', reason: 'max_tools', message: limitMsg });
        }

        // Push tool_start segment + SSE
        const callId = toolUse.id;
        segments.push({
          type: 'tool',
          tool: {
            callId,
            name: toolUse.name,
            args: toolUse.input,
            status: 'running',
          },
        });
        sendSSE(res, {
          type: 'tool_start',
          tool: {
            callId,
            name: toolUse.name,
            args: toolUse.input,
          },
        });

        // Execute the tool
        const toolStartTime = Date.now();
        let output: any;
        let isError = false;
        try {
          const limit = enforceToolCallLimit({
            toolName: toolUse.name,
            toolInput: toolUse.input,
            toolNameCount,
            sqlIntentCounts,
          });
          if (limit.limited) {
            output = limit.output;
          } else {
            const toolDef = activeTools.find((t) => t.definition.name === toolUse.name) || agentConfig.tools.find((t) => t.definition.name === toolUse.name);
            if (!toolDef) {
              throw new Error(`Unknown tool: ${toolUse.name}`);
            }
            output = await toolDef.execute(toolUse.input);
          }
          isError = !!(output?.error || output?.isError);
        } catch (err: any) {
          output = { error: err.message };
          isError = true;
        }
        if (isError) toolErrorCounter++;
        const duration = Date.now() - toolStartTime;

        // Log tool output
        const outputPreview = typeof output === 'string'
          ? output.slice(0, 300)
          : JSON.stringify(output)?.slice(0, 300);
        logger.info(`[copilot] Tool #${toolCallCounter} result: ${toolUse.name} → ${isError ? 'ERROR' : 'OK'} (${duration}ms)`, {
          outputPreview,
          cached: output?._cached || false,
        });

        // Track
        toolTrace.push({
          name: toolUse.name,
          args: toolUse.input,
          result: output,
          duration,
        });

        // Update segment
        const summary = generateToolSummary(toolUse.name, output, isError, toolUse.input, agentConfig.language);
        const toolSeg = segments.find(
          (s) => s.type === 'tool' && s.tool?.callId === callId
        );
        if (toolSeg && toolSeg.tool) {
          toolSeg.tool.result = output;
          toolSeg.tool.summary = summary;
          toolSeg.tool.duration = duration;
          toolSeg.tool.status = isError ? 'error' : 'success';
          if (isError) {
            toolSeg.tool.error = typeof output === 'string' ? output : output?.message || output?.error;
          }
        }

        // Send tool_end SSE
        sendSSE(res, {
          type: 'tool_end',
          tool: {
            callId,
            name: toolUse.name,
            summary,
            result: typeof output === 'string' ? output.slice(0, 200) : output,
            duration,
            status: isError ? 'error' : 'success',
            error: isError ? (typeof output === 'string' ? output : output?.message) : undefined,
          },
        });

        // Semantic anti-loop: detect consecutive empty/no-result responses
        const resultStr = typeof output === 'string' ? output : JSON.stringify(output) ?? '';
        const isEmpty = isToolResultEffectivelyEmpty(output);
        if (isEmpty) {
          consecutiveEmptyResults++;
          if (!limitReached && consecutiveEmptyResults >= 3) {
            limitReached = true;
            hitLoopDetection = true;
            const limitMsg = statusLabels.limitEmptyResults;
            sendSSE(res, { type: 'limit_reached', reason: 'semantic_empty_results', message: limitMsg });
            finalOutput += `\n\n${limitMsg}`;
            sendSSE(res, { type: 'text_delta', delta: `\n\n${limitMsg}` });
            logger.warn(`[copilot] Semantic anti-loop: ${consecutiveEmptyResults} consecutive empty tool results`);
          }
        } else {
          consecutiveEmptyResults = 0;
        }

        // Add tool result (trimmed only for very large payloads)
        const rawContent = resultStr;
        const trimmedContent = (rawContent || '[no output]').length > 8000
          ? rawContent.slice(0, 8000) + '\n... [trimmed — ' + rawContent.length + ' chars total]'
          : rawContent || '[no output]';
        toolResults.push({
          role: 'tool',
          tool_call_id: toolUse.id,
          content: trimmedContent || '[no output]',
        });
      }

      // Add tool result messages (one per tool call) to the conversation
      messages.push(...toolResults);

      // If limit reached, break out of the loop
      if (limitReached) break;
    }

    // Log run summary
    const elapsed = Date.now() - turnStart;
    logger.info(`[copilot] Done — ${toolCallCounter} tools, ${elapsed}ms, output: ${finalOutput.length} chars, tokens: {in: ${totalInputTokens}, out: ${totalOutputTokens}, cached: ${totalCacheReadTokens}}`, {
      toolNames: toolTrace.map((t) => t.name).join(', '),
      finalOutputPreview: finalOutput.slice(0, 200),
      firstTokenMs,
      firstToolMs,
    });
  } catch (error: any) {
    logger.error('SSE stream error:', error);
    const userMessage = isOverloadedProviderError(error)
      ? statusLabels.providerOverloaded
      : error.message || statusLabels.providerUnavailable;
    sendSSE(res, { type: 'error', error: userMessage });
  } finally {
    clearInterval(heartbeatId);
  }

  // Post-process: sanitize Mermaid code in diagram blocks
  const sanitized = sanitizeDiagramBlocks(finalOutput);
  if (sanitized !== finalOutput) {
    finalOutput = sanitized;
    sendSSE(res, { type: 'content_corrected', content: sanitized });
    for (const seg of segments) {
      if (seg.type === 'text') {
        // Preserve text/tool/text ordering as emitted by the agent.
        seg.content = sanitizeDiagramBlocks(seg.content || '');
      }
    }
  }

  // Sanitize output — remove invalid entity cards before sending to client
  const agentMode = agentConfig.mode;
  const sanitized2 = sanitizeOutput(finalOutput, agentMode);
  if (sanitized2 !== finalOutput) {
    finalOutput = sanitized2;
    sendSSE(res, { type: 'content_corrected', content: sanitized2 });
    for (const seg of segments) {
      if (seg.type === 'text') {
        seg.content = sanitizeOutput(seg.content || '', agentMode);
      }
    }
  }

  const allowedEntityIds = collectEntityIds(toolTrace.map((t) => t.result));
  const sanitized3 = sanitizeEntityCardsByAllowedIds(finalOutput, allowedEntityIds);
  if (sanitized3 !== finalOutput) {
    finalOutput = sanitized3;
    sendSSE(res, { type: 'content_corrected', content: sanitized3 });
    for (const seg of segments) {
      if (seg.type === 'text') {
        seg.content = sanitizeEntityCardsByAllowedIds(seg.content || '', allowedEntityIds);
      }
    }
  }

  // Run output guardrail (non-blocking — logs only, does not block)
  try {
    const { outputFormatGuardrail } = await import('../guardrails/output.guardrail');
    await outputFormatGuardrail.execute({
      agentOutput: finalOutput,
      agent: { name: agentConfig.name },
    });
  } catch {
    // Output guardrail is non-blocking
  }

  const traceMetrics = {
    turnCount,
    toolCount: toolCallCounter,
    toolNames: [...new Set(toolTrace.map((t) => t.name))],
    toolErrors: toolErrorCounter,
    durationMs: Date.now() - turnStart,
    outputChars: finalOutput.length,
    hasToolError: toolErrorCounter > 0,
    hitLoopDetection,
    hitTurnLimit,
    guardrailBlocked,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheCreationTokens: totalCacheCreationTokens,
    estimatedCostUsd,
    firstTokenMs,
    firstToolMs,
    promptChars,
    toolSchemaChars,
  };

  return { finalOutput, toolTrace, segments, traceMetrics };
}

/**
 * Post-process finalOutput to sanitize Mermaid code inside ```diagram blocks.
 */
function sanitizeDiagramBlocks(text: string): string {
  return text.replace(/```diagram\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/g, (fullMatch, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      // Normalize key aliases: mermaidCode/content → code (mobile expects 'code')
      if (!parsed.code && (parsed.mermaidCode || parsed.content)) {
        parsed.code = parsed.mermaidCode || parsed.content;
        delete parsed.mermaidCode;
        delete parsed.content;
      }
      // Normalize diagramType/diagram_type → type (mobile expects 'type')
      if (!parsed.type && (parsed.diagramType || parsed.diagram_type)) {
        parsed.type = parsed.diagramType || parsed.diagram_type;
        delete parsed.diagramType;
        delete parsed.diagram_type;
      }
      if (parsed.code && typeof parsed.code === 'string') {
        let code = parsed.code;
        // Normalize <br> variants and literal \n to <br> (Mermaid line breaks)
        code = code.replace(/<br\s*\/?>/gi, '<br>');
        code = code.replace(/\\n/g, '<br>');
        code = code.replace(/\[([^\]]*)\]/g, (_: string, content: string) => {
          const fixed = content.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
          return `[${fixed}]`;
        });
        code = code.replace(/\|([^|]*)\|/g, (_: string, content: string) => {
          const fixed = content.replace(/[<>]/g, '').replace(/≤/g, ' lte ').replace(/≥/g, ' gte ');
          return `|${fixed}|`;
        });
        parsed.code = code;
      }
      return '```diagram\n' + JSON.stringify(parsed) + '\n```';
    } catch {
      return fullMatch;
    }
  });
}

/** Stable stringify with sorted object keys (for deterministic loop detection). */
function stableStringify(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Generate a session title using the fast model
 */
export async function generateSessionTitle(
  message: string,
  language: SupportedLanguage = 'en',
  usageContext?: { billedActionCode?: string | null; scopeTalentId?: string | null; scopeOrganizationId?: string | null; sessionId?: string | null }
): Promise<string> {
  try {
    const { MODEL_FAST } = await import('../../ai/models');
    const client = getChatClient();
    const { buildSessionTitleSystemPrompt } = await import('../../ai/prompts/session-utils.prompt');
    const languageName = getLanguageDisplayName(language);

    const response = await client.chat.completions.create({
      model: MODEL_FAST,
      max_completion_tokens: 50,
      messages: [
        { role: 'system', content: buildSessionTitleSystemPrompt(languageName) },
        { role: 'user', content: message },
      ],
    });

    void recordUsage({
      feature: 'session_title',
      model: MODEL_FAST,
      usage: response.usage as any,
      scopeTalentId: usageContext?.scopeTalentId ?? null,
      scopeOrganizationId: usageContext?.scopeOrganizationId ?? null,
      sessionId: usageContext?.sessionId ?? null,
      billedActionCode: usageContext?.billedActionCode ?? null,
    });

    const raw = (response.choices[0]?.message?.content || message.slice(0, 50)).trim();
    // Strip any markdown formatting (**, *, #, quotes)
    const title = (raw || message.slice(0, 50))
      .replace(/[*#`"]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return title || message.slice(0, 50);
  } catch (error) {
    logger.warn('[copilot] Session title generation fell back to deterministic mode', { error });
    const words = message.replace(/[?!.,]/g, '').trim().split(/\s+/);
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }
}

/**
 * Generate prompt suggestions through the configured AI provider.
 */
export async function generateSuggestions(
  mode: string,
  contextSummary: string,
  language: SupportedLanguage = 'en'
): Promise<string[]> {
  try {
    const { buildSuggestionsSystemPrompt } = await import('../../ai/prompts/session-utils.prompt');
    const { getSuggestionClient } = await import('../../ai/provider');
    const { MODEL_SUGGESTION } = await import('../../ai/models');

    const systemPrompt = buildSuggestionsSystemPrompt(mode, contextSummary, getLanguageDisplayName(language));
    const client = getSuggestionClient();
    const completion = await client.chat.completions.create({
      model: MODEL_SUGGESTION,
      max_completion_tokens: 160,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate the suggestions in ${getLanguageDisplayName(language)}.` },
      ],
    });

    void recordUsage({
      feature: 'suggestions',
      model: MODEL_SUGGESTION,
      usage: completion.usage as any,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    return JSON.parse(text);
  } catch {
    return [];
  }
}
