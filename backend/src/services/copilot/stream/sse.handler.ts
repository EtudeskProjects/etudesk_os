/**
 * SSE Streaming Handler
 * Handles Server-Sent Events for real-time copilot responses
 */

import { Response } from 'express';
import { run, user } from '@openai/agents';
import type { Agent, AgentInputItem } from '@openai/agents';
import { SSEEvent } from '../types';

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
 * Returns the final output text for DB persistence
 */
export async function runAgentWithSSE(
  agent: Agent,
  message: string,
  history: Array<{ role: string; content: string }>,
  res: Response
): Promise<{
  finalOutput: string;
  toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }>;
}> {
  const toolTrace: Array<{ name: string; args?: any; result?: any; duration?: number }> = [];
  let finalOutput = '';
  const toolStartTimes = new Map<string, number>();

  try {
    // Build input: just pass the current message as string
    // History is handled by the agent's conversation context
    const input = message;

    const result = await run(agent, input, { stream: true });

    for await (const event of result as AsyncIterable<any>) {
      // Handle text deltas
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as any;
        if (data?.type === 'output_text_delta') {
          const delta = data.delta as string;
          finalOutput += delta;
          sendSSE(res, { type: 'text_delta', delta });
        }
      }

      // Handle tool events
      if (event.type === 'run_item_stream_event') {
        const item = event.item as any;

        if (event.name === 'tool_called') {
          const toolName = item?.call?.name || item?.name || 'unknown';
          toolStartTimes.set(toolName, Date.now());
          sendSSE(res, {
            type: 'tool_start',
            tool: {
              name: toolName,
              args: item?.call?.args || item?.arguments,
            },
          });
        }

        if (event.name === 'tool_output') {
          const toolName = item?.call?.name || item?.name || 'unknown';
          const startTime = toolStartTimes.get(toolName);
          const duration = startTime ? Date.now() - startTime : undefined;
          toolStartTimes.delete(toolName);

          const traceEntry = {
            name: toolName,
            args: item?.call?.args || item?.arguments,
            result: item?.output,
            duration,
          };
          toolTrace.push(traceEntry);

          sendSSE(res, {
            type: 'tool_end',
            tool: {
              name: toolName,
              result: typeof item?.output === 'string'
                ? item.output.slice(0, 200)
                : item?.output,
              duration,
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
    console.error('SSE stream error:', error);
    sendSSE(res, { type: 'error', error: error.message || 'Erreur interne' });
  }

  return { finalOutput, toolTrace };
}

/**
 * Generate a session title using gpt-5-nano
 */
export async function generateSessionTitle(message: string): Promise<string> {
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content:
            'Génère un titre court (3-6 mots max) en français pour cette conversation. Pas de guillemets, pas de ponctuation finale.',
        },
        { role: 'user', content: message },
      ],
      max_tokens: 20,
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content?.trim() || message.slice(0, 50);
  } catch {
    // Fallback to simple extraction
    const words = message.replace(/[?!.,]/g, '').trim().split(/\s+/);
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }
}

/**
 * Generate prompt suggestions using gpt-5-nano
 */
export async function generateSuggestions(
  mode: string,
  contextSummary: string
): Promise<string[]> {
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Génère exactement 3 suggestions de prompts courts en français pour un assistant ${mode === 'study' ? "d'étude" : "d'exploration"}.
Contexte utilisateur: ${contextSummary}
Retourne un JSON array de 3 strings. Rien d'autre.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    return JSON.parse(text);
  } catch {
    return [];
  }
}
