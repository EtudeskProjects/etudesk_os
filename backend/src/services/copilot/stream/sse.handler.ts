/**
 * SSE Streaming Handler — Native Anthropic SDK
 * Handles Server-Sent Events for real-time copilot responses.
 * Uses anthropicClient.messages.stream() with a manual agentic loop.
 */

import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig } from '../tools/tool-helper';
import { SSEEvent, MessageSegment } from '../types';
import { runInputGuardrail } from '../guardrails/input.guardrail';
import { getAnthropicClient } from '../../ai/provider';
import { generateToolSummary } from './tool-summary';
import { sanitizeOutput } from '../guardrails/output.guardrail';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

const MAX_TURNS = 15;
const MAX_TOOL_CALLS = 20;
const MAX_SAME_TOOL_CALLS = 3;
const MAX_TURN_DURATION_MS = 120_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const SSE_BUFFER_FLUSH_MS = 50; // Buffer text deltas and flush every 50ms
const MAX_PROVIDER_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

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

/**
 * Build Anthropic messages array from history + user message + attachments
 */
function buildMessages(
  history: Array<{ role: string; content: string }>,
  message: string,
  attachments?: Array<{ id: string; name: string; url: string; type: string; size?: number }>,
  imageBuffers?: Array<{ mimeType: string; base64: string; name: string }>
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history (already alternating user/assistant from DB)
  // Skip entries with empty content — Anthropic rejects empty user messages
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

  // Image attachments → multimodal content parts
  if (imageBuffers && imageBuffers.length > 0) {
    const imgNames = imageBuffers.map((b) => `- ${b.name}`).join('\n');
    userMessage += `\n\n[Pièces jointes — Images]\n${imgNames}\nThe images are provided below for direct visual analysis. Describe and analyze them.`;

    const contentParts: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: userMessage },
    ];
    for (const img of imageBuffers) {
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.base64,
        },
      });
    }
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // Ensure alternating roles (merge consecutive same-role messages)
  const merged: Anthropic.MessageParam[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      // Merge text content — keep whichever is non-empty, or combine both
      const lastText = typeof last.content === 'string' ? last.content : '';
      const msgText = typeof msg.content === 'string' ? msg.content : '';
      last.content = [lastText, msgText].filter(Boolean).join('\n') || lastText || msgText;
    } else {
      merged.push(msg);
    }
  }

  return merged;
}

/**
 * Run an agent with SSE streaming using native Anthropic SDK.
 * Manual agentic loop: stream → collect tool_use → execute → re-submit.
 */
export async function runAgentWithSSE(
  agentConfig: AgentConfig,
  message: string,
  history: Array<{ role: string; content: string }>,
  res: Response,
  attachments?: Array<{ id: string; name: string; url: string; type: string; size?: number }>
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
  const sameToolCounts = new Map<string, number>();

  const heartbeatId = setInterval(() => sendHeartbeat(res), HEARTBEAT_INTERVAL_MS);
  logger.info(`[copilot] Start — "${message.slice(0, 100)}" (history: ${history.length} msgs)`);

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

    // Build native Anthropic messages
    const messages = buildMessages(history, message, attachments, imageBuffers);

    // Check guardrail result
    const guardrailResult = await guardrailPromise;
    if (guardrailResult.tripwireTriggered) {
      const classification = guardrailResult.outputInfo?.classification || 'BLOCKED';
      logger.warn(`[guardrail] Input blocked — classification: ${classification}`);
      const userMessage = classification === 'INJECTION'
        ? 'Je ne peux pas répondre à ce type de requête. Reformulez votre question en lien avec la plateforme.'
        : 'Cette requête ne peut pas être traitée. Je suis là pour vous accompagner sur la plateforme Etudesk.';
      sendSSE(res, { type: 'error', error: userMessage });
      guardrailBlocked = true;
      return {
        finalOutput: '', toolTrace: [], segments: [],
        traceMetrics: {
          turnCount: 0, toolCount: 0, toolNames: [], toolErrors: 0,
          durationMs: Date.now() - turnStart, outputChars: 0,
          hasToolError: false, hitLoopDetection: false, hitTurnLimit: false, guardrailBlocked: true,
          inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
        },
      };
    }

    // --- Agentic loop ---
    const client = getAnthropicClient();
    const toolDefs = agentConfig.tools.map((t) => t.definition);

    while (turnCount < MAX_TURNS) {
      turnCount++;
      if (turnCount >= MAX_TURNS) hitTurnLimit = true;

      // Check duration limit
      if (!limitReached && Date.now() - turnStart > MAX_TURN_DURATION_MS) {
        limitReached = true;
        const limitMsg = 'Temps maximum atteint. Voici les résultats disponibles.';
        sendSSE(res, { type: 'limit_reached', reason: 'max_duration', message: limitMsg });
        break;
      }

      // Stream the response — with prompt caching on system prompt
      let response: Anthropic.Message | null = null;
      let currentTurnText = '';
      let toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];
      const maxAttempts = MAX_PROVIDER_RETRIES + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let attemptProducedOutput = false;
        currentTurnText = '';
        toolUseBlocks = [];
        let currentToolUse: { id: string; name: string; inputJson: string } | null = null;
        let textBuffer = '';
        let bufferTimer: ReturnType<typeof setTimeout> | null = null;

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
          const stream = client.messages.stream({
            model: agentConfig.model,
            system: [
              {
                type: 'text' as const,
                text: agentConfig.systemPrompt,
                cache_control: { type: 'ephemeral' as const },
              },
            ],
            messages,
            tools: toolDefs,
            max_tokens: 4096,
          });

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = (event as any).content_block;
              if (block?.type === 'tool_use') {
                flushTextBuffer();
                currentToolUse = { id: block.id, name: block.name, inputJson: '' };
                attemptProducedOutput = true;
              }
            }

            if (event.type === 'content_block_delta') {
              const delta = (event as any).delta;
              if (delta?.type === 'text_delta' && delta.text) {
                finalOutput += delta.text;
                currentTurnText += delta.text;
                textBuffer += delta.text;

                const lastSeg = segments[segments.length - 1];
                if (lastSeg && lastSeg.type === 'text') {
                  lastSeg.content = (lastSeg.content || '') + delta.text;
                } else {
                  segments.push({ type: 'text', content: delta.text });
                }

                if (!bufferTimer) {
                  bufferTimer = setTimeout(flushTextBuffer, SSE_BUFFER_FLUSH_MS);
                }
              }
              if (delta?.type === 'input_json_delta' && currentToolUse) {
                currentToolUse.inputJson += delta.partial_json || '';
              }
            }

            if (event.type === 'content_block_stop') {
              if (currentToolUse) {
                let parsedInput: any = {};
                try {
                  parsedInput = JSON.parse(currentToolUse.inputJson || '{}');
                } catch {
                  parsedInput = {};
                }
                toolUseBlocks.push({
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: parsedInput,
                });
                currentToolUse = null;
              }
            }
          }

          flushTextBuffer();
          response = await stream.finalMessage();

          // Accumulate token usage
          if (response?.usage) {
            totalInputTokens += response.usage.input_tokens || 0;
            totalOutputTokens += response.usage.output_tokens || 0;
            totalCacheReadTokens += (response.usage as any).cache_read_input_tokens || 0;
          }
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

      // If no tool_use blocks, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        break;
      }

      // --- Execute tool calls ---
      // Add assistant message to conversation
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCallCounter++;

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

        if (!limitReached && sameCount > MAX_SAME_TOOL_CALLS) {
          limitReached = true;
          hitLoopDetection = true;
          const limitMsg = `Boucle d'outils detectee (${toolUse.name} appele ${sameCount} fois). Je stoppe ici pour eviter de gaspiller des credits.`;
          logger.warn(`[copilot] Tool loop detected — ${loopKey} (#${sameCount}). Aborting run.`);
          sendSSE(res, { type: 'limit_reached', reason: 'tool_loop', message: limitMsg });
          finalOutput += `\n\n${limitMsg}`;
          sendSSE(res, { type: 'text_delta', delta: `\n\n${limitMsg}` });
          // Return cached error for remaining tool results
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: 'Tool loop detected. Stopping.' }),
          });
          continue;
        }

        // Check tool count limit
        if (!limitReached && toolCallCounter > MAX_TOOL_CALLS) {
          limitReached = true;
          const limitMsg = `Limite de ${MAX_TOOL_CALLS} outils atteinte. Voici les résultats disponibles.`;
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
          const toolDef = agentConfig.tools.find((t) => t.definition.name === toolUse.name);
          if (!toolDef) {
            throw new Error(`Unknown tool: ${toolUse.name}`);
          }
          output = await toolDef.execute(toolUse.input);
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
        const summary = generateToolSummary(toolUse.name, output, isError, toolUse.input);
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

        // Add tool result for Anthropic (trimmed only for very large payloads)
        const rawContent = typeof output === 'string' ? output : JSON.stringify(output) ?? '';
        const trimmedContent = (rawContent || '[no output]').length > 8000
          ? rawContent.slice(0, 8000) + '\n... [trimmed — ' + rawContent.length + ' chars total]'
          : rawContent || '[no output]';
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: trimmedContent || '[no output]',
        });
      }

      // Add tool results as user message
      messages.push({ role: 'user', content: toolResults });

      // If limit reached, break out of the loop
      if (limitReached) break;
    }

    // Log run summary
    const elapsed = Date.now() - turnStart;
    logger.info(`[copilot] Done — ${toolCallCounter} tools, ${elapsed}ms, output: ${finalOutput.length} chars, tokens: {in: ${totalInputTokens}, out: ${totalOutputTokens}, cached: ${totalCacheReadTokens}}`, {
      toolNames: toolTrace.map((t) => t.name).join(', '),
      finalOutputPreview: finalOutput.slice(0, 200),
    });
  } catch (error: any) {
    logger.error('SSE stream error:', error);
    const userMessage = isOverloadedProviderError(error)
      ? 'Service IA temporairement saturé. Merci de réessayer dans quelques secondes.'
      : error.message || 'Erreur interne';
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
  const agentMode = agentConfig.name.includes('study') ? 'study'
    : agentConfig.name.includes('Organization') ? 'org'
    : 'explore';
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
 * Generate a session title using Anthropic Haiku
 */
export async function generateSessionTitle(message: string): Promise<string> {
  try {
    const { MODEL_FAST } = await import('../../ai/models');
    const client = getAnthropicClient();
    const { SESSION_TITLE_SYSTEM_PROMPT } = await import('../../ai/prompts/session-utils.prompt');

    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 50,
      system: [
        {
          type: 'text' as const,
          text: SESSION_TITLE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: message }],
    });

    const title = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : message.slice(0, 50);
    return title || message.slice(0, 50);
  } catch {
    const words = message.replace(/[?!.,]/g, '').trim().split(/\s+/);
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }
}

/**
 * Generate prompt suggestions using Gemini (unchanged — still via @openai/agents)
 */
export async function generateSuggestions(
  mode: string,
  contextSummary: string
): Promise<string[]> {
  try {
    const { buildSuggestionsSystemPrompt } = await import('../../ai/prompts/session-utils.prompt');
    const { createSuggestionsAgent } = await import('../../ai/agent-factory');
    const { Runner } = await import('@openai/agents');
    const { geminiProvider } = await import('../../ai/provider');

    const systemPrompt = buildSuggestionsSystemPrompt(mode, contextSummary);
    const agent = createSuggestionsAgent(systemPrompt);
    const geminiRunner = new Runner({ modelProvider: geminiProvider });
    const result = await geminiRunner.run(agent, 'Génère les suggestions.');
    const text = result.finalOutput?.trim() || '[]';
    return JSON.parse(text);
  } catch {
    return [];
  }
}
