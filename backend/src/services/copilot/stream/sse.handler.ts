/**
 * SSE Streaming Handler
 * Handles Server-Sent Events for real-time copilot responses
 */

import { Response } from 'express';
import { run, Runner, InputGuardrailTripwireTriggered } from '@openai/agents';
import type { Agent, AgentInputItem } from '@openai/agents';
import { SSEEvent, MessageSegment } from '../types';
import { createTitleAgent, createSuggestionsAgent } from '../../ai/agent-factory';
import { buildSuggestionsSystemPrompt } from '../../ai/prompts/session-utils.prompt';
import { geminiProvider } from '../../ai/provider';
import { generateToolSummary } from './tool-summary';
import { getFileBuffer } from '../../storage.service';

import { logger } from '../../../utils';

const MAX_TOOL_CALLS = 20;
const MAX_TURN_DURATION_MS = 120_000; // 2 minutes
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s — avoid proxy timeouts

/**
 * Send SSE comment (heartbeat) — keeps connection alive, no client-side event
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
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx
  res.flushHeaders();
}

/**
 * Send an SSE event to the client
 */
export function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Run an agent with SSE streaming
 * Returns the final output text, tool trace, and ordered segments for DB persistence
 */
export async function runAgentWithSSE(
  agent: Agent,
  message: string,
  history: Array<{ role: string; content: string }>,
  res: Response,
  attachments?: Array<{ id: string; name: string; url: string; type: string; size?: number }>
): Promise<{
  finalOutput: string;
  toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }>;
  segments: MessageSegment[];
}> {
  const toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }> = [];
  const segments: MessageSegment[] = [];
  let finalOutput = '';
  const toolStartTimes = new Map<string, number>();
  let toolCallCounter = 0;
  const turnStart = Date.now();
  let limitReached = false;

  const heartbeatId = setInterval(() => sendHeartbeat(res), HEARTBEAT_INTERVAL_MS);

  try {
    // Build input with history + attachment context
    const inputItems: AgentInputItem[] = [];

    // Add conversation history
    for (const h of history) {
      if (h.role === 'user') {
        inputItems.push({ role: 'user', content: h.content });
      } else if (h.role === 'assistant') {
        inputItems.push({
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: h.content }],
        } as AgentInputItem);
      }
    }

    // Separate image attachments (vision) from document attachments (FileReaderAgent)
    const imageAttachments = attachments?.filter((a) => a.type.startsWith('image/')) || [];
    const docAttachments = attachments?.filter((a) => !a.type.startsWith('image/')) || [];

    let userMessage = message;

    // For documents (PDFs, etc.) → FileReaderAgent with documentId
    if (docAttachments.length > 0) {
      const docList = docAttachments
        .map((a) => `- ${a.name} (${a.type}) [documentId: ${a.id}]`)
        .join('\n');
      userMessage += `\n\n[Pièces jointes — Documents]\n${docList}\nIMPORTANT: Hand off to FileReaderAgent with the documentId above to read and analyze each attached document.`;
    }

    // For images → include as vision content parts (GPT-5 multimodal)
    if (imageAttachments.length > 0) {
      const imgNames = imageAttachments.map((a) => `- ${a.name}`).join('\n');
      userMessage += `\n\n[Pièces jointes — Images]\n${imgNames}\nThe images are provided below for direct visual analysis. Describe and analyze them.`;

      // Build multimodal content: text + image_url parts
      const contentParts: any[] = [{ type: 'input_text', text: userMessage }];
      for (const img of imageAttachments) {
        try {
          const buffer = await getFileBuffer(img.url);
          if (!buffer || buffer.length === 0) {
            throw new Error('Empty file buffer');
          }
          const base64 = buffer.toString('base64');
          const mimeType = img.type || 'image/png';
          contentParts.push({
            type: 'input_image',
            image: `data:${mimeType};base64,${base64}`,
            detail: 'auto',
          });
        } catch (err: any) {
          logger.error(`Failed to load image ${img.name}: ${err.message}`);
          // Fallback: mention file cannot be loaded
          contentParts[0] = { type: 'input_text', text: userMessage + `\n(Note: impossible de charger l'image ${img.name})` };
        }
      }

      inputItems.push({ role: 'user', content: contentParts } as AgentInputItem);
    } else {
      inputItems.push({ role: 'user', content: userMessage });
    }

    const input = inputItems;
    const result = await run(agent, input, { stream: true });

    for await (const event of result as AsyncIterable<any>) {
      // Check duration limit
      if (!limitReached && Date.now() - turnStart > MAX_TURN_DURATION_MS) {
        limitReached = true;
        const limitMsg = 'Temps maximum atteint. Voici les résultats disponibles.';
        sendSSE(res, { type: 'limit_reached', reason: 'max_duration', message: limitMsg });
      }

      // Handle text deltas
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as any;
        if (data?.type === 'output_text_delta') {
          const delta = data.delta as string;
          finalOutput += delta;
          sendSSE(res, { type: 'text_delta', delta });

          // Append to last text segment or create a new one
          const lastSeg = segments[segments.length - 1];
          if (lastSeg && lastSeg.type === 'text') {
            lastSeg.content = (lastSeg.content || '') + delta;
          } else {
            segments.push({ type: 'text', content: delta });
          }
        }
      }

      // Handle tool events
      if (event.type === 'run_item_stream_event') {
        const item = event.item as any;

        if (event.name === 'tool_called') {
          toolCallCounter++;
          const toolName = item?.rawItem?.name || item?.call?.name || item?.name || item?.type || 'unknown';
          const toolArgs = item?.rawItem?.arguments || item?.call?.args || item?.arguments;
          const callId = `${toolName}-${Date.now()}-${toolCallCounter}`;
          toolStartTimes.set(callId, Date.now());

          // Store callId on the item for matching in tool_output
          if (item) item._callId = callId;

          // Check tool count limit
          if (!limitReached && toolCallCounter > MAX_TOOL_CALLS) {
            limitReached = true;
            const limitMsg = `Limite de ${MAX_TOOL_CALLS} outils atteinte. Voici les résultats disponibles.`;
            sendSSE(res, { type: 'limit_reached', reason: 'max_tools', message: limitMsg });
          }

          // Push tool segment
          segments.push({
            type: 'tool',
            tool: {
              callId,
              name: toolName,
              args: typeof toolArgs === 'string' ? safeParseArgs(toolArgs) : toolArgs,
              status: 'running',
            },
          });

          sendSSE(res, {
            type: 'tool_start',
            tool: {
              callId,
              name: toolName,
              args: typeof toolArgs === 'string' ? safeParseArgs(toolArgs) : toolArgs,
            },
          });
        }

        if (event.name === 'tool_output') {
          const toolName = item?.rawItem?.name || item?.call?.name || item?.name || item?.type || 'unknown';
          const toolArgs = item?.rawItem?.arguments || item?.call?.args || item?.arguments;
          const callId = item?._callId || `${toolName}-unknown`;
          const startTime = toolStartTimes.get(callId);
          const duration = startTime ? Date.now() - startTime : undefined;
          toolStartTimes.delete(callId);

          const output = item?.output;
          const isError = !!(output?.error || output?.isError);
          const parsedArgs = typeof toolArgs === 'string' ? safeParseArgs(toolArgs) : toolArgs;
          const summary = generateToolSummary(toolName, output, isError, parsedArgs);

          const traceEntry = {
            name: toolName,
            args: toolArgs,
            result: output,
            duration,
          };
          toolTrace.push(traceEntry);

          // Update matching segment
          const toolSeg = segments.find(
            (s) => s.type === 'tool' && s.tool?.callId === callId
          );
          if (toolSeg && toolSeg.tool) {
            toolSeg.tool.result = output;
            toolSeg.tool.summary = summary;
            toolSeg.tool.duration = duration;
            toolSeg.tool.status = isError ? 'error' : 'success';
            if (isError) {
              toolSeg.tool.error = typeof output === 'string' ? output : (output as any)?.message || (output as any)?.error;
            }
          }

          sendSSE(res, {
            type: 'tool_end',
            tool: {
              callId,
              name: toolName,
              summary,
              result: typeof output === 'string' ? output.slice(0, 200) : output,
              duration,
              status: isError ? 'error' : 'success',
              error: isError ? (typeof output === 'string' ? output : (output as any)?.message) : undefined,
            },
          });
        }
      }
    }

    // Ensure we capture final output if not captured via stream
    await (result as any).completed;
    if (!finalOutput && (result as any).finalOutput) {
      finalOutput = typeof (result as any).finalOutput === 'string'
        ? (result as any).finalOutput
        : JSON.stringify((result as any).finalOutput);
    }
  } catch (error: any) {
    if (error instanceof InputGuardrailTripwireTriggered) {
      const classification = error.result?.output?.outputInfo?.classification || 'BLOCKED';
      logger.warn(`[guardrail] Input blocked — classification: ${classification}`);
      const userMessage = classification === 'INJECTION'
        ? 'Je ne peux pas répondre à ce type de requête. Reformulez votre question en lien avec la plateforme.'
        : 'Cette requête ne peut pas être traitée. Je suis là pour vous accompagner sur la plateforme Etudesk.';
      sendSSE(res, { type: 'error', error: userMessage });
    } else {
      logger.error('SSE stream error:', error);
      sendSSE(res, { type: 'error', error: error.message || 'Erreur interne' });
    }
  } finally {
    clearInterval(heartbeatId);
  }

  // Post-process: sanitize Mermaid code in diagram blocks
  const sanitized = sanitizeDiagramBlocks(finalOutput);
  if (sanitized !== finalOutput) {
    finalOutput = sanitized;
    // Send corrected content so frontend can update its rendered output
    sendSSE(res, { type: 'content_corrected', content: sanitized });
    // Also update text segments with sanitized content
    let fullText = '';
    for (const seg of segments) {
      if (seg.type === 'text') {
        fullText += seg.content || '';
      }
    }
    if (fullText) {
      const sanitizedFull = sanitizeDiagramBlocks(fullText);
      if (sanitizedFull !== fullText) {
        // Rebuild text segments with single sanitized segment
        const nonTextSegments = segments.filter(s => s.type !== 'text');
        segments.length = 0;
        segments.push({ type: 'text', content: sanitizedFull });
        segments.push(...nonTextSegments);
      }
    }
  }

  return { finalOutput, toolTrace, segments };
}

/**
 * Post-process finalOutput to sanitize Mermaid code inside ```diagram blocks.
 * Fixes common LLM issues: <br/> tags, parentheses in [] labels, special chars.
 */
function sanitizeDiagramBlocks(text: string): string {
  return text.replace(/```diagram\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/g, (fullMatch, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.code && typeof parsed.code === 'string') {
        let code = parsed.code;
        // Replace <br/> and <br> with \n
        code = code.replace(/<br\s*\/?>/gi, '\\n');
        // Escape parentheses inside square bracket labels []
        code = code.replace(/\[([^\]]*)\]/g, (_: string, content: string) => {
          const fixed = content.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
          return `[${fixed}]`;
        });
        // Fix pipe-based conditions: |text| must not contain special chars
        code = code.replace(/\|([^|]*)\|/g, (_: string, content: string) => {
          const fixed = content.replace(/[<>]/g, '').replace(/≤/g, ' lte ').replace(/≥/g, ' gte ');
          return `|${fixed}|`;
        });
        parsed.code = code;
      }
      return '```diagram\n' + JSON.stringify(parsed) + '\n```';
    } catch {
      return fullMatch; // If JSON parsing fails, return as-is
    }
  });
}

/** Safely parse JSON args string, fallback to wrapping as-is */
function safeParseArgs(args: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(args);
  } catch {
    return args ? { raw: args } : undefined;
  }
}

/**
 * Generate a session title using Agents SDK (gpt-5-nano)
 */
export async function generateSessionTitle(message: string): Promise<string> {
  try {
    const agent = createTitleAgent();
    const result = await run(agent, message);
    return result.finalOutput?.trim() || message.slice(0, 50);
  } catch {
    // Fallback to simple extraction
    const words = message.replace(/[?!.,]/g, '').trim().split(/\s+/);
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }
}

/**
 * Generate prompt suggestions using Agents SDK (gpt-5-nano)
 */
export async function generateSuggestions(
  mode: string,
  contextSummary: string
): Promise<string[]> {
  try {
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
