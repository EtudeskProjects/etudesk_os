/**
 * Anthropic Provider — Adapter for @openai/agents-core Model/ModelProvider
 * Translates Anthropic native SDK to the OpenAI Agents SDK interfaces
 * so agents can run on Claude models natively (no OpenAI-compat proxy).
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Model,
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from '@openai/agents-core';
import type { StreamEvent } from '@openai/agents-core';
import { Usage } from '@openai/agents-core';
import { logger } from '../../utils';

// ---------------------------------------------------------------------------
// Helpers — translate between SDK formats
// ---------------------------------------------------------------------------

/** Convert AgentInputItem[] to Anthropic messages format */
function toAnthropicMessages(
  input: ModelRequest['input'],
): Anthropic.MessageParam[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  const messages: Anthropic.MessageParam[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;

    const role = (item as any).role as string | undefined;
    if (!role) continue;

    if (role === 'user') {
      const content = (item as any).content;
      if (typeof content === 'string') {
        messages.push({ role: 'user', content });
      } else if (Array.isArray(content)) {
        // Multimodal content parts
        const parts: Anthropic.ContentBlockParam[] = [];
        for (const part of content) {
          if (part.type === 'input_text') {
            parts.push({ type: 'text', text: part.text });
          } else if (part.type === 'input_image') {
            // data:mime;base64,DATA
            const match = part.image?.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: match[1] as any,
                  data: match[2],
                },
              });
            }
          }
        }
        if (parts.length > 0) {
          messages.push({ role: 'user', content: parts });
        }
      }
    } else if (role === 'assistant') {
      const content = (item as any).content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .filter((c: any) => c.type === 'output_text')
          .map((c: any) => c.text)
          .join('');
      }
      if (text) {
        messages.push({ role: 'assistant', content: text });
      }
    } else if (role === 'system') {
      // System messages get merged into user context (Anthropic has separate system param)
      const text = typeof (item as any).content === 'string'
        ? (item as any).content
        : '';
      if (text) {
        messages.push({ role: 'user', content: `[System] ${text}` });
      }
    }

    // Handle function_call items (tool use by assistant)
    if ((item as any).type === 'function_call') {
      const fc = item as any;
      messages.push({
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: fc.callId || fc.id || `call_${Date.now()}`,
            name: fc.name,
            input: typeof fc.arguments === 'string'
              ? JSON.parse(fc.arguments || '{}')
              : fc.arguments || {},
          },
        ],
      });
    }

    // Handle function_call_output items (tool results)
    if ((item as any).type === 'function_call_output') {
      const fr = item as any;
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: fr.callId || fr.id || 'unknown',
            content: typeof fr.output === 'string'
              ? fr.output
              : JSON.stringify(fr.output),
          },
        ],
      });
    }
  }

  // Anthropic requires at least one message
  if (messages.length === 0) {
    messages.push({ role: 'user', content: '.' });
  }

  // Anthropic requires alternating user/assistant. Merge consecutive same-role messages.
  const merged: Anthropic.MessageParam[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      // Merge content
      const lastText = typeof last.content === 'string' ? last.content : '';
      const msgText = typeof msg.content === 'string' ? msg.content : '';
      if (lastText && msgText) {
        last.content = lastText + '\n' + msgText;
      }
      // If either is array, skip merge (keep last)
    } else {
      merged.push(msg);
    }
  }

  return merged;
}

/** Convert SerializedTool[] to Anthropic tool format */
function toAnthropicTools(
  tools: ModelRequest['tools'],
): Anthropic.Tool[] {
  return tools
    .filter((t) => t.type === 'function')
    .map((t) => ({
      name: (t as any).name,
      description: (t as any).description || '',
      input_schema: (t as any).parameters || { type: 'object' as const, properties: {} },
    }));
}

// ---------------------------------------------------------------------------
// AnthropicModel — implements Model interface
// ---------------------------------------------------------------------------

class AnthropicModel implements Model {
  constructor(
    private client: Anthropic,
    private modelName: string,
  ) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const messages = toAnthropicMessages(request.input);
    const tools = toAnthropicTools(request.tools);

    const params: Anthropic.MessageCreateParams = {
      model: this.modelName,
      max_tokens: request.modelSettings.maxTokens || 4096,
      messages,
      ...(request.systemInstructions && { system: request.systemInstructions }),
      ...(tools.length > 0 && { tools }),
      ...(request.modelSettings.temperature != null && {
        temperature: request.modelSettings.temperature,
      }),
      ...(request.modelSettings.topP != null && {
        top_p: request.modelSettings.topP,
      }),
    };

    const response = await this.client.messages.create(params);

    // Convert Anthropic response to AgentOutputItem[]
    const output: any[] = [];

    const textParts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        // Flush accumulated text first
        if (textParts.length > 0) {
          output.push({
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: textParts.join('') }],
          });
          textParts.length = 0;
        }
        output.push({
          type: 'function_call',
          callId: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
          status: 'completed',
        });
      }
    }

    // Remaining text
    if (textParts.length > 0) {
      output.push({
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: textParts.join('') }],
      });
    }

    return {
      usage: new Usage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        requests: 1,
      }),
      output,
      responseId: response.id,
    };
  }

  async *getStreamedResponse(
    request: ModelRequest,
  ): AsyncIterable<StreamEvent> {
    const messages = toAnthropicMessages(request.input);
    const tools = toAnthropicTools(request.tools);

    const params: Anthropic.MessageCreateParams = {
      model: this.modelName,
      max_tokens: request.modelSettings.maxTokens || 4096,
      messages,
      stream: true,
      ...(request.systemInstructions && { system: request.systemInstructions }),
      ...(tools.length > 0 && { tools }),
      ...(request.modelSettings.temperature != null && {
        temperature: request.modelSettings.temperature,
      }),
      ...(request.modelSettings.topP != null && {
        top_p: request.modelSettings.topP,
      }),
    };

    const stream = this.client.messages.stream(params);

    let inputTokens = 0;
    let outputTokens = 0;
    const outputItems: any[] = [];
    const textParts: string[] = [];
    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    yield { type: 'response_started' } as StreamEvent;

    for await (const event of stream) {
      if (event.type === 'message_start') {
        inputTokens = event.message?.usage?.input_tokens || 0;
      }

      if (event.type === 'message_delta') {
        outputTokens = (event as any).usage?.output_tokens || outputTokens;
      }

      if (event.type === 'content_block_start') {
        const block = (event as any).content_block;
        if (block?.type === 'tool_use') {
          // Flush text before tool use
          if (textParts.length > 0) {
            outputItems.push({
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text: textParts.join('') }],
            });
            textParts.length = 0;
          }
          currentToolUse = { id: block.id, name: block.name, inputJson: '' };
        }
      }

      if (event.type === 'content_block_delta') {
        const delta = (event as any).delta;
        if (delta?.type === 'text_delta' && delta.text) {
          textParts.push(delta.text);
          yield { type: 'output_text_delta', delta: delta.text } as StreamEvent;
        }
        if (delta?.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.inputJson += delta.partial_json || '';
        }
      }

      if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          outputItems.push({
            type: 'function_call',
            callId: currentToolUse.id,
            name: currentToolUse.name,
            arguments: currentToolUse.inputJson || '{}',
            status: 'completed',
          });
          currentToolUse = null;
        }
      }
    }

    // Flush remaining text
    if (textParts.length > 0) {
      outputItems.push({
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: textParts.join('') }],
      });
    }

    yield {
      type: 'response_done',
      response: {
        id: `anthropic_${Date.now()}`,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        output: outputItems,
      },
    } as StreamEvent;
  }
}

// ---------------------------------------------------------------------------
// AnthropicProvider — implements ModelProvider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements ModelProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.defaultModel = options?.defaultModel || 'claude-opus-4-6';
  }

  getModel(modelName?: string): Model {
    return new AnthropicModel(this.client, modelName || this.defaultModel);
  }
}
